class SQLValidatorApp {
  constructor() {
    this.apiBaseUrl = window.location.origin;
    this.initializeEventListeners();
  }

  initializeEventListeners() {
    // Main buttons
    document
      .getElementById("validateBtn")
      .addEventListener("click", () => this.validateQuery());
    document
      .getElementById("autoFixBtn")
      .addEventListener("click", () => this.autoFixQuery());
    document
      .getElementById("clearBtn")
      .addEventListener("click", () => this.clearAll());

    // Example queries
    document.querySelectorAll(".example-card").forEach((card) => {
      card.addEventListener("click", () => {
        const query = card.getAttribute("data-query");
        this.loadExampleQuery(query);
      });
    });

    // Suggestion and copy buttons
    document
      .getElementById("applySuggestion")
      .addEventListener("click", () => this.applySuggestion());
    document
      .getElementById("copyFixedQuery")
      .addEventListener("click", () => this.copyFixedQuery());

    // Enter key to validate
    document.getElementById("sqlQuery").addEventListener("keydown", (e) => {
      if (e.ctrlKey && e.key === "Enter") {
        this.validateQuery();
      }
    });
  }

  async validateQuery() {
    const query = document.getElementById("sqlQuery").value.trim();
    const strictMode = document.getElementById("strictMode").checked;

    if (!query) {
      this.showToast("Masukkan query SQL terlebih dahulu", "error");
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/validate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, strictMode }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }

      this.displayValidationResult(data);
    } catch (error) {
      console.error("Validation error:", error);
      this.showToast(`Error: ${error.message}`, "error");
    } finally {
      this.showLoading(false);
    }
  }

  async autoFixQuery() {
    const query = document.getElementById("sqlQuery").value.trim();

    if (!query) {
      this.showToast("Masukkan query SQL terlebih dahulu", "error");
      return;
    }

    this.showLoading(true);

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/auto-fix`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Terjadi kesalahan");
      }

      this.displayAutoFixResult(data);
    } catch (error) {
      console.error("Auto-fix error:", error);
      this.showToast(`Error: ${error.message}`, "error");
    } finally {
      this.showLoading(false);
    }
  }

  displayValidationResult(data) {
    const resultCard = document.getElementById("validationResult");
    const statusBadge = document.getElementById("statusBadge");
    const queryType = document.getElementById("queryType");
    const whereStatus = document.getElementById("whereStatus");
    const errorsContainer = document.getElementById("errorsContainer");
    const warningsContainer = document.getElementById("warningsContainer");
    const suggestionContainer = document.getElementById("suggestionContainer");

    // Show result card
    resultCard.classList.remove("hidden");

    // Set status
    if (data.isValid) {
      statusBadge.textContent = "VALID";
      statusBadge.className = "status-badge valid";
    } else {
      statusBadge.textContent = "INVALID";
      statusBadge.className = "status-badge invalid";
    }

    // Set query details
    queryType.textContent = data.queryType || "UNKNOWN";
    whereStatus.textContent = data.hasWhere
      ? "✅ Ditemukan"
      : "❌ Tidak Ditemukan";

    // Display errors
    if (data.errors && data.errors.length > 0) {
      const errorsList = document.getElementById("errorsList");
      errorsList.innerHTML = "";
      data.errors.forEach((error) => {
        const li = document.createElement("li");
        li.textContent = error;
        errorsList.appendChild(li);
      });
      errorsContainer.classList.remove("hidden");
    } else {
      errorsContainer.classList.add("hidden");
    }

    // Display warnings
    if (data.warnings && data.warnings.length > 0) {
      const warningsList = document.getElementById("warningsList");
      warningsList.innerHTML = "";
      data.warnings.forEach((warning) => {
        const li = document.createElement("li");
        li.textContent = warning;
        warningsList.appendChild(li);
      });
      warningsContainer.classList.remove("hidden");
    } else {
      warningsContainer.classList.add("hidden");
    }

    // Show suggestion if there's commented WHERE
    if (
      data.warnings &&
      data.warnings.some((w) => w.includes("dalam komentar"))
    ) {
      suggestionContainer.classList.remove("hidden");
      document.getElementById("suggestionText").textContent =
        'Kami menemukan WHERE clause dalam komentar. Klik "Terapkan Saran" untuk mengaktifkannya secara otomatis.';
    } else {
      suggestionContainer.classList.add("hidden");
    }

    // Hide fixed query section
    document.getElementById("fixedQuerySection").classList.add("hidden");
  }

  displayAutoFixResult(data) {
    this.displayValidationResult(data.validation);

    if (data.fixesApplied.length > 0) {
      const fixedQuerySection = document.getElementById("fixedQuerySection");
      const fixedQuery = document.getElementById("fixedQuery");

      fixedQuery.textContent = data.fixedQuery;
      fixedQuerySection.classList.remove("hidden");

      this.showToast(
        `Berhasil menerapkan ${data.fixesApplied.length} perbaikan`,
        "success"
      );
    }
  }

  applySuggestion() {
    this.autoFixQuery();
  }

  copyFixedQuery() {
    const fixedQuery = document.getElementById("fixedQuery").textContent;
    navigator.clipboard.writeText(fixedQuery).then(() => {
      this.showToast("Query berhasil disalin!", "success");
    });
  }

  loadExampleQuery(query) {
    document.getElementById("sqlQuery").value = query;
    this.showToast("Contoh query dimuat", "info");
  }

  clearAll() {
    document.getElementById("sqlQuery").value = "";
    document.getElementById("validationResult").classList.add("hidden");
    document.getElementById("fixedQuerySection").classList.add("hidden");
    this.showToast("Semua input dan hasil dihapus", "info");
  }

  showLoading(show) {
    const overlay = document.getElementById("loadingOverlay");
    if (show) {
      overlay.classList.remove("hidden");
    } else {
      overlay.classList.add("hidden");
    }
  }

  showToast(message, type = "info") {
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toastMessage");

    // Set background color based on type
    const colors = {
      success: "#059669",
      error: "#dc2626",
      warning: "#d97706",
      info: "#2563eb",
    };

    toast.style.background = colors[type] || colors.info;
    toastMessage.textContent = message;
    toast.classList.remove("hidden");

    // Auto hide after 3 seconds
    setTimeout(() => {
      toast.classList.add("hidden");
    }, 3000);
  }
}

// Initialize app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new SQLValidatorApp();
});
