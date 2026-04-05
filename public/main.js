const app = Vue.createApp({
  data() {
    return {
      simpleText: []
    };
  },
  mounted() {
    fetch("simpleText.json")
      .then((response) => response.json())
      .then((data) => {
        this.simpleText = data;
      })
      .catch((error) => {
        console.error("加载文本数据失败：", error);
      });
  }
});

app.use(ElementPlus);

app.component("story-item", {
  props: ["index", "text"],
  template: `
    <div class="story-item">
      <div class="story-index">{{ index }}</div>
      <p class="story-text">{{ text }}</p>
    </div>
  `
});

app.mount(".page-shell");
