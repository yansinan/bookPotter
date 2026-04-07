const LEARNED_KEY = "bookPotter_learnedWords";

// Escape for HTML attribute values (& must come first to avoid double-escaping)
function escAttr(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Escape for HTML body text (quotes are safe and readable in text content)
function escText(s) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Regex to locate vocab placeholders in processed story text.
// Defined at module level to avoid recreation on every render;
// lastIndex must be reset to 0 before each use because of the global flag.
const VOCAB_KEY_RE = /__VOCAB_\d+__/g;

const app = Vue.createApp({
  data() {
    return {
      simpleText: [],
      originalText: [],
      vocab: [],
      currentView: "simple",
      learnedWords: [],
      tooltip: {
        visible: false,
        word: "",
        pinyin: "",
        meaning: "",
        x: 0,
        y: 0,
      },
    };
  },

  computed: {
    currentText() {
      return this.currentView === "simple" ? this.simpleText : this.originalText;
    },
    vocabMap() {
      const map = {};
      for (const item of this.vocab) {
        map[item.word] = item;
      }
      return map;
    },
    tooltipStyle() {
      const width = 220;
      const x = Math.max(8, Math.min(this.tooltip.x - width / 2, window.innerWidth - width - 8));
      return {
        position: "fixed",
        top: this.tooltip.y + "px",
        left: x + "px",
        width: width + "px",
      };
    },
  },

  mounted() {
    Promise.all([
      fetch("simpleText.json").then((r) => r.json()),
      fetch("originalText.json").then((r) => r.json()),
      fetch("vocab.json").then((r) => r.json()),
    ])
      .then(([simple, original, vocab]) => {
        this.simpleText = simple;
        this.originalText = original;
        this.vocab = vocab;
      })
      .catch((err) => {
        console.error("加载数据失败：", err);
      });

    // Restore learned words from localStorage
    try {
      const saved = JSON.parse(localStorage.getItem(LEARNED_KEY) || "[]");
      if (Array.isArray(saved)) this.learnedWords = saved;
    } catch (e) {
      console.warn("Failed to restore learned words:", e);
      this.learnedWords = [];
    }

    // Close tooltip when clicking outside
    document.addEventListener("click", (e) => {
      if (!e.target.closest(".vocab-word") && !e.target.closest(".pinyin-tooltip")) {
        this.tooltip.visible = false;
      }
    });
  },

  methods: {
    switchView(view) {
      this.currentView = view;
      this.tooltip.visible = false;
    },

    handleWordClick(event) {
      const span = event.target.closest(".vocab-word");
      if (!span) return;
      event.stopPropagation();

      const { word, pinyin, meaning } = span.dataset;

      // Mark as learned
      if (!this.learnedWords.includes(word)) {
        this.learnedWords.push(word);
        // Persist to localStorage (placeholder for future Alibaba Object Storage Service integration)
        localStorage.setItem(LEARNED_KEY, JSON.stringify(this.learnedWords));
      }

      // Position tooltip below the clicked word
      const rect = span.getBoundingClientRect();
      this.tooltip = {
        visible: true,
        word,
        pinyin,
        meaning,
        x: rect.left + rect.width / 2,
        y: rect.bottom + 8,
      };
    },

    showVocabDetail(item) {
      // Mark as learned when clicking from the vocab panel
      if (!this.learnedWords.includes(item.word)) {
        this.learnedWords.push(item.word);
        localStorage.setItem(LEARNED_KEY, JSON.stringify(this.learnedWords));
      }
      const centerX = window.innerWidth / 2;
      const centerY = window.innerHeight / 2 - 60;
      this.tooltip = {
        visible: true,
        word: item.word,
        pinyin: item.pinyin,
        meaning: item.meaning,
        x: centerX,
        y: centerY,
      };
    },

    closeTooltip() {
      this.tooltip.visible = false;
    },
  },
});

app.use(ElementPlus);

app.component("story-item", {
  props: ["index", "text", "vocabMap", "learnedWords"],
  computed: {
    processedHtml() {
      if (!this.vocabMap || Object.keys(this.vocabMap).length === 0) {
        return this.text;
      }
      // Sort vocab words longest-first to prefer multi-character matches
      const sortedWords = Object.keys(this.vocabMap).sort((a, b) => b.length - a.length);

      // Use unambiguous placeholder markers that won't appear in Chinese prose
      const placeholders = {};
      let result = this.text;
      sortedWords.forEach((word, idx) => {
        const key = `__VOCAB_${idx}__`;
        placeholders[key] = this.vocabMap[word];
        result = result.split(word).join(key);
      });

      // Rebuild as HTML string; reset lastIndex because VOCAB_KEY_RE is a global regex
      VOCAB_KEY_RE.lastIndex = 0;
      let html = "";
      let lastIndex = 0;
      let match;
      while ((match = VOCAB_KEY_RE.exec(result)) !== null) {
        // Escape plain text before this match
        html += escText(result.slice(lastIndex, match.index));

        const item = placeholders[match[0]];
        const learned = this.learnedWords && this.learnedWords.includes(item.word) ? " learned" : "";
        html +=
          `<span class="vocab-word${learned}"` +
          ` data-word="${escAttr(item.word)}"` +
          ` data-pinyin="${escAttr(item.pinyin)}"` +
          ` data-meaning="${escAttr(item.meaning)}">` +
          `${escText(item.word)}</span>`;

        lastIndex = match.index + match[0].length;
      }
      // Append remaining plain text
      html += escText(result.slice(lastIndex));
      return html;
    },
  },
  template: `
    <div class="story-item">
      <span class="story-index">{{ index }}</span>
      <p class="story-text" v-html="processedHtml"></p>
    </div>
  `,
});

app.mount(".page-shell");
