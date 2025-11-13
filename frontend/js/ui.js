// Additional UI enhancements
class UIEnhancements {
  constructor() {
    this.initSyntaxHighlighting();
    this.initResizableTextarea();
  }

  initSyntaxHighlighting() {
    const textarea = document.getElementById("sqlQuery");

    textarea.addEventListener("input", function () {
      // Simple SQL keyword highlighting
      const sqlKeywords = [
        "SELECT",
        "FROM",
        "WHERE",
        "UPDATE",
        "DELETE",
        "INSERT",
        "INTO",
        "SET",
        "VALUES",
        "CREATE",
        "TABLE",
        "DROP",
        "ALTER",
        "JOIN",
        "LEFT",
        "RIGHT",
        "INNER",
        "OUTER",
        "ON",
        "GROUP BY",
        "ORDER BY",
        "HAVING",
        "LIMIT",
        "OFFSET",
        "AND",
        "OR",
        "NOT",
        "LIKE",
        "IN",
        "BETWEEN",
        "IS NULL",
        "IS NOT NULL",
      ];

      let value = this.value;

      // Highlight keywords (simple implementation)
      sqlKeywords.forEach((keyword) => {
        const regex = new RegExp(`\\b${keyword}\\b`, "gi");
        value = value.replace(regex, `<strong>${keyword}</strong>`);
      });

      // For a real implementation, you'd want to use a proper syntax highlighter
      // This is just a simple demonstration
    });
  }

  initResizableTextarea() {
    const textarea = document.getElementById("sqlQuery");

    textarea.addEventListener("focus", function () {
      this.style.height = "200px";
    });

    textarea.addEventListener("blur", function () {
      if (this.value === "") {
        this.style.height = "auto";
      }
    });
  }
}

// Initialize UI enhancements
document.addEventListener("DOMContentLoaded", () => {
  new UIEnhancements();
});
