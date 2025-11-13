const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Enhanced Query Validator Class untuk multiple queries
class QueryValidator {
  constructor() {
    this.rules = {
      requireWhere: true,
      allowDrop: false,
      allowTruncate: false,
      strictWhereValidation: true,
    };
  }

  validateQuery(inputQuery) {
    console.log("🔍 Starting validation for:", inputQuery);

    const results = [];
    const allErrors = [];
    const allWarnings = [];
    let overallIsValid = true;

    try {
      // Split multiple queries
      const queries = this.splitQueries(inputQuery);
      console.log("🔍 Split into queries:", queries);
      console.log("📝 Found queries:", queries.length, queries);

      // Validasi setiap query
      let validQueryCount = 0;
      let dangerousQueryCount = 0;
      let queriesWithActiveWhere = 0;

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i].trim();
        if (!query) continue;

        console.log(`🔧 Validating query ${i + 1}: "${query}"`);

        const result = this.validateSingleQuery(query, i + 1);
        results.push(result);

        // Hitung statistik
        if (result.isValid) {
          validQueryCount++;
        } else {
          dangerousQueryCount++;
          overallIsValid = false;
        }

        // Hanya hitung WHERE yang aktif, bukan yang dikomentari
        if (result.hasWhere === true) {
          queriesWithActiveWhere++;
        }

        // Kumpulkan semua errors dan warnings
        allErrors.push(...result.errors);
        allWarnings.push(...result.warnings);
      }

      // Warning untuk multiple queries
      if (queries.length > 1) {
        allWarnings.push(
          `⚠️ Ditemukan ${queries.length} queries. ${validQueryCount} valid, ${dangerousQueryCount} berbahaya.`
        );
      }

      // Error kritis untuk multiple dangerous queries
      if (dangerousQueryCount > 0 && queries.length > 1) {
        allErrors.push(
          `🚨 CRITICAL: Ditemukan ${dangerousQueryCount} query berbahaya!`
        );
        allErrors.push(
          "💀 HENTIKAN EKSEKUSI! Beberapa query dapat mengubah semua data dalam tabel."
        );
        overallIsValid = false;
      }

      // Jika tidak ada query yang valid
      if (results.length === 0) {
        allErrors.push("❌ Tidak ada query SQL yang valid ditemukan");
        overallIsValid = false;
      }

      return {
        isValid: overallIsValid,
        errors: allErrors,
        warnings: allWarnings,
        queryType: results.length > 0 ? results[0].queryType : "UNKNOWN",
        hasWhere: queriesWithActiveWhere > 0,
        queryCount: queries.length,
        validQueryCount: validQueryCount,
        dangerousQueryCount: dangerousQueryCount,
        queriesWithActiveWhere: queriesWithActiveWhere,
        individualResults: results,
      };
    } catch (error) {
      console.error("❌ Error during validation:", error);
      return {
        isValid: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        queryType: "UNKNOWN",
        hasWhere: false,
        queryCount: 0,
        validQueryCount: 0,
        dangerousQueryCount: 0,
        queriesWithActiveWhere: 0,
        individualResults: [],
      };
    }
  }

  splitQueries(inputQuery) {
    // Simple approach: split by semicolon, then trim
    const rawQueries = inputQuery.split(";");
    const queries = [];

    for (let rawQuery of rawQueries) {
      const trimmed = rawQuery.trim();
      if (trimmed) {
        queries.push(trimmed);
      }
    }

    console.log("📝 Simple split queries result:", queries);
    return queries;
  }

  validateSingleQuery(query, queryNumber = 1) {
    const errors = [];
    const warnings = [];

    try {
      const queryType = this.getQueryType(query);
      console.log(`📝 Query ${queryNumber} type:`, queryType);

      const hasActiveWhere = this.hasActiveWhere(query);
      const hasCommentedWhere = this.detectWhereInComment(query);

      console.log(
        `📍 Query ${queryNumber} - Active WHERE: ${hasActiveWhere}, Commented WHERE: ${hasCommentedWhere}`
      );

      // RULE 1: Jika WHERE ada di komentar -> langsung INVALID
      if (hasCommentedWhere) {
        errors.push(
          `[Query Line ${queryNumber}] ❌ INVALID: WHERE ditemukan dalam komentar!`
        );

        return {
          isValid: false,
          errors,
          warnings,
          queryType,
          hasWhere: false,
          queryNumber,
        };
      }

      // Validasi ketat untuk UPDATE/DELETE tanpa WHERE sama sekali
      if (queryType === "UPDATE" || queryType === "DELETE") {
        if (!hasActiveWhere) {
          // Tidak ada WHERE sama sekali - ERROR PARAH
          errors.push(
            `[Query ${queryNumber}] 💀 SANGAT BERBAHAYA: Query ${queryType} TANPA WHERE CLAUSE!`
          );
          errors.push(
            `[Query ${queryNumber}] 🚫 Query ini akan mengubah SEMUA data dalam tabel!`
          );
        }
      }

      // Validasi query berbahaya lainnya
      if (query.toUpperCase().includes("DROP TABLE") && !this.rules.allowDrop) {
        errors.push(
          `[Query ${queryNumber}] ❌ Query DROP TABLE tidak diizinkan`
        );
      }

      if (
        query.toUpperCase().includes("TRUNCATE") &&
        !this.rules.allowTruncate
      ) {
        errors.push(`[Query ${queryNumber}] ❌ Query TRUNCATE tidak diizinkan`);
      }

      // Warning untuk SELECT tanpa LIMIT
      if (queryType === "SELECT" && !query.toUpperCase().includes("LIMIT")) {
        warnings.push(
          `[Query ${queryNumber}] 💡 Pertimbangkan untuk menggunakan LIMIT pada query SELECT besar`
        );
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        queryType,
        hasWhere: hasActiveWhere, // hanya WHERE yang benar-benar aktif
        queryNumber,
      };
    } catch (error) {
      console.error(`❌ Error validating query ${queryNumber}:`, error);
      return {
        isValid: false,
        errors: [`[Query ${queryNumber}] Validation error: ${error.message}`],
        warnings: [],
        queryType: "UNKNOWN",
        hasWhere: false,
        queryNumber,
      };
    }
  }

  getQueryType(query) {
    try {
      const cleanQuery = this.removeComments(query);
      const firstWord = cleanQuery.trim().split(/\s+/)[0].toUpperCase();
      return firstWord || "UNKNOWN";
    } catch (error) {
      console.error("Error getting query type:", error);
      return "UNKNOWN";
    }
  }

  hasActiveWhere(query) {
    try {
      const lines = query.split("\n");
      let activeWhere = false;

      for (let line of lines) {
        const trimmedLine = line.trim();

        // Skip lines yang pure komentar
        if (trimmedLine.startsWith("--") || trimmedLine.startsWith("//")) {
          continue;
        }

        // Handle inline comments (-- dan //)
        let codePart = trimmedLine;

        // Remove everything after -- jika ada
        const dashCommentIndex = codePart.indexOf("--");
        if (dashCommentIndex !== -1) {
          codePart = codePart.substring(0, dashCommentIndex);
        }

        // Remove everything after // jika ada
        const slashCommentIndex = codePart.indexOf("//");
        if (slashCommentIndex !== -1) {
          codePart = codePart.substring(0, slashCommentIndex);
        }

        // Deteksi WHERE yang aktif (harus ada setelah SET/UPDATE/DELETE)
        const wherePattern = /\bwhere\b\s+[^\s;]/i;
        if (wherePattern.test(codePart)) {
          activeWhere = true;
          break;
        }
      }

      console.log(`🔍 Active WHERE detection for query -> ${activeWhere}`);
      return activeWhere;
    } catch (error) {
      console.error("Error detecting active WHERE:", error);
      return false;
    }
  }

  detectWhereInComment(query) {
    try {
      const lines = query.split("\n");
      let commentedWhere = false;

      for (let line of lines) {
        const trimmedLine = line.trim();

        // Cek WHERE dalam line komentar penuh
        if (trimmedLine.startsWith("--") || trimmedLine.startsWith("//")) {
          const wherePattern = /\bwhere\b\s+[^\s]/i;
          if (wherePattern.test(trimmedLine)) {
            commentedWhere = true;
            break;
          }
        }

        // Cek WHERE setelah kode yang dikomentari inline
        const hasInlineCommentedWhere =
          /[^-\s]\s*--\s*where\b/i.test(line) ||
          /[^\/\s]\s*\/\/\s*where\b/i.test(line);

        if (hasInlineCommentedWhere) {
          commentedWhere = true;
          break;
        }
      }

      console.log(`🔍 Commented WHERE detection -> ${commentedWhere}`);
      return commentedWhere;
    } catch (error) {
      console.error("Error detecting commented WHERE:", error);
      return false;
    }
  }

  removeComments(query) {
    try {
      let cleanQuery = query
        .replace(/--.*$/gm, "")
        .replace(/\/\/.*$/gm, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\s+/g, " ")
        .trim();
      return cleanQuery;
    } catch (error) {
      console.error("Error removing comments:", error);
      return query;
    }
  }

  extractCommentedWhere(query) {
    try {
      console.log("🔍 Extracting commented WHERE from:", query);

      const lines = query.split("\n");

      for (let line of lines) {
        const trimmedLine = line.trim();

        // Cek untuk --WHERE
        if (trimmedLine.includes("--")) {
          const dashIndex = trimmedLine.indexOf("--");
          const afterDash = trimmedLine.substring(dashIndex + 2).trim();

          if (afterDash.toUpperCase().startsWith("WHERE")) {
            console.log("🔍 Found --WHERE:", afterDash);
            return afterDash;
          }
        }

        // Cek untuk //WHERE
        if (trimmedLine.includes("//")) {
          const slashIndex = trimmedLine.indexOf("//");
          const afterSlash = trimmedLine.substring(slashIndex + 2).trim();

          if (afterSlash.toUpperCase().startsWith("WHERE")) {
            console.log("🔍 Found //WHERE:", afterSlash);
            return afterSlash;
          }
        }
      }

      console.log("🔍 No commented WHERE found");
      return null;
    } catch (error) {
      console.error("Error extracting commented WHERE:", error);
      return null;
    }
  }

  setRules(newRules) {
    this.rules = { ...this.rules, ...newRules };
  }
}

const validator = new QueryValidator();

// API Routes
app.post("/api/validate", (req, res) => {
  console.log("📨 Received validation request");

  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }

    const { query, strictMode = true } = req.body;

    console.log("📝 Request:", {
      query: query ? query.substring(0, 100) + "..." : "EMPTY",
      strictMode,
    });

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      });
    }

    // Set rules
    validator.setRules({
      strictWhereValidation: strictMode,
    });

    const result = validator.validateQuery(query);

    console.log(`✅ Validation completed:`, {
      isValid: result.isValid,
      queryCount: result.queryCount,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error("💥 Server error in /api/validate:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
});

app.post("/api/auto-fix", (req, res) => {
  console.log("🔧 Received auto-fix request");

  try {
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: "Request body is required",
      });
    }

    const { query } = req.body;

    if (!query) {
      return res.status(400).json({
        success: false,
        error: "Query is required",
      });
    }

    const validation = validator.validateQuery(query);
    let fixedQuery = query;
    let fixesApplied = [];

    console.log("🔍 Auto-fix analyzing validation:", {
      isValid: validation.isValid,
      queryCount: validation.queryCount,
      individualResults: validation.individualResults,
    });

    // Auto-fix untuk setiap query yang bermasalah
    if (!validation.isValid && validation.individualResults) {
      const queries = validator.splitQueries(query);
      const fixedQueries = [];

      for (let i = 0; i < queries.length; i++) {
        const originalQuery = queries[i];
        let fixedSingleQuery = originalQuery;
        let queryFixes = [];

        console.log(`🔧 Processing query ${i + 1}:`, originalQuery);

        // Cek jika query ini memiliki WHERE dalam komentar
        const hasCommentedWhere = validator.detectWhereInComment(originalQuery);
        const hasActiveWhere = validator.hasActiveWhere(originalQuery);

        console.log(
          `🔍 Query ${
            i + 1
          } - Active WHERE: ${hasActiveWhere}, Commented WHERE: ${hasCommentedWhere}`
        );

        if (
          !hasActiveWhere &&
          hasCommentedWhere &&
          (validation.individualResults[i]?.queryType === "UPDATE" ||
            validation.individualResults[i]?.queryType === "DELETE")
        ) {
          console.log(`🛠️ Fixing query ${i + 1} with commented WHERE`);

          // Ekstrak WHERE dari komentar dan aktifkan
          const commentedWhere = validator.extractCommentedWhere(originalQuery);
          if (commentedWhere) {
            // Hapus komentar dari WHERE clause
            fixedSingleQuery = originalQuery
              .replace(/--\s*where.*$/i, " " + commentedWhere) // Remove --WHERE and activate
              .replace(/\/\/\s*where.*$/i, " " + commentedWhere) // Remove //WHERE and activate
              .replace(/\s+/g, " ") // Normalize spaces
              .trim();

            queryFixes.push(
              `Mengaktifkan WHERE clause dari komentar: ${commentedWhere}`
            );
            console.log(`✅ Fixed query ${i + 1}:`, fixedSingleQuery);
          }
        }

        fixedQueries.push(fixedSingleQuery);
        if (queryFixes.length > 0) {
          fixesApplied.push(`Query ${i + 1}: ${queryFixes.join(", ")}`);
        }
      }

      // Gabungkan kembali query yang sudah difix
      fixedQuery =
        fixedQueries.join("; ") + (fixedQueries.length > 0 ? ";" : "");
    }

    // Validasi ulang query yang sudah difix
    const newValidation = validator.validateQuery(fixedQuery);

    console.log("🔧 Auto-fix completed:", {
      originalQuery: query,
      fixedQuery: fixedQuery,
      fixesApplied: fixesApplied,
      newIsValid: newValidation.isValid,
    });

    res.json({
      success: true,
      originalQuery: query,
      fixedQuery: fixedQuery,
      fixesApplied: fixesApplied,
      validation: newValidation,
    });
  } catch (error) {
    console.error("💥 Server error in /api/auto-fix:", error);
    res.status(500).json({
      success: false,
      error: "Internal server error: " + error.message,
    });
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({
    status: "OK",
    message: "SQL Query Validator is running",
    timestamp: new Date().toISOString(),
  });
});

// Serve frontend
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

app.listen(PORT, () => {
  console.log("🚀 Enhanced SQL Query Validator Server Started!");
  console.log(`📍 Running on: http://localhost:${PORT}`);
  console.log("✅ Now supports multiple queries detectiondsdsd!");
});
