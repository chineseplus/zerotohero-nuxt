import { languageLevels, LANGS_WITH_LEVELS } from "../utils";
import { Capacitor } from "@capacitor/core";
import { mapState } from "vuex";
import navItemsMixin from "./nav-items-mixin";

export default {
  mixins: [navItemsMixin],
  data() {
    return {
      shortcuts: [],
      tvShowsCount: false,
      hasLiveTV: false,
      talksCount: false,
      audioBooksCount: false,
      hasPhrasebooks: false,
      stats: undefined,
    };
  },
  computed: {
    ...mapState("fullHistory", ["fullHistory"]),
    ...mapState("shows", ["categories"]),
    pro() {
      return this.forcePro || this.$store.state.subscriptions.active;
    },
    isPWA() {
      return (
        (typeof navigator !== "undefined" && navigator.standalone) ||
        (typeof window !== "undefined" &&
          window.matchMedia("(display-mode: standalone)").matches)
      );
    },
    currentParent() {
      return this.findParent(this.$route.name);
    },
    levels() {
      // Levels feature works for Chinese, German, English, Spanish, French and Arabic only
      if (this.$l2 && LANGS_WITH_LEVELS.includes(this.$l2.code)) {
        return languageLevels(this.$l2);
      } else return {};
    },
    fullHistoryPathsByL1L2() {
      if (!this.l1 || !this.l2) return;
      return this.$store.getters["fullHistory/fullHistoryPathsByL1L2"]({
        l1: this.l1,
        l2: this.l2,
      });
    },
    userIsAdmin() {
      return this.$auth.user && this.$auth.user.role == 1;
    },
    native() {
      return Capacitor.isNativePlatform();
    },
    savedWordsCount() {
      if (!this.l2) return
      let count = this.$store.getters["savedWords/todayWordCount"]({ l2: this.l2.code });
      // eslint-disable-next-line vue/no-parsing-error
      return count;
    },
    savedPhrasesCount() {
      if (!this.l2) return
      let count = this.$store.getters["savedPhrases/count"]({
        l2: this.l2.code,
      });
      // eslint-disable-next-line vue/no-parsing-error
      return count;
    },
  },
  created() {
    if (!this.$l1 || !this.$l2) return;
    this.checkShows();
    this.checkPhrasebooks();
    this.unsubscribe = this.$store.subscribe((mutation, state) => {
      if (mutation.type.startsWith("shows")) {
        this.checkShows();
      }
      if (mutation.type.startsWith("phrasebooks")) {
        this.checkPhrasebooks();
      }
      if (mutation.type.startsWith("stats")) {
        this.checkStats();
      }
    });
    if (this.$hasFeature("live-tv")) {
      this.hasLiveTV = true;
    }
  },
  methods: {
    checkShows() {
      if (!this.l2) return;
      let tvShowsCount =
        this.$store.state.shows.tvShows &&
        this.$store.state.shows.tvShows[this.l2.code] &&
        this.$store.state.shows.tvShows[this.l2.code].length;

      let talksCount =
        this.$store.state.shows.talks &&
        this.$store.state.shows.talks[this.l2.code] &&
        this.$store.state.shows.talks[this.l2.code].filter(
          (s) => !s.audiobook
        ).length;
      this.tvShowsCount = tvShowsCount;
      this.talksCount = talksCount;
    },
    hasFeature(feature) {
      return this.$hasFeature(feature);
    },
    checkPhrasebooks() {
      if (!this.l2) return;
      this.hasPhrasebooks =
        this.$store.state.phrasebooks.phrasebooks &&
        this.$store.state.phrasebooks.phrasebooks[this.l2.code] &&
        this.$store.state.phrasebooks.phrasebooks[this.l2.code].length > 0;
    },
    checkStats() {
      if (!this.l2) return;
      this.stats =
        this.$store.state.stats.stats &&
        this.$store.state.stats.stats[this.l2.code];
    },
    to(item) {
      if (item.to) return item.to;
      let selfOrFirstChild = this.selfOrFirstChild(item, true);
      if (this.currentParent === item) return selfOrFirstChild; // Clicking on the same navigation item as the currently active one should return to the "root' of that navigation item
      if (item.exact) return selfOrFirstChild;
      else return this.last(item) || selfOrFirstChild;
    },
    hasFeature(feature) {
      return this.$l1 && this.$l2 && this.$hasFeature(feature);
    },
    nameOfSelfOrFirstChild(item, visibleOnly) {
      let result = this.selfOrFirstChild(item, visibleOnly);
      if (result) {
        return result.name;
      }
    },
    selfOrFirstChild(item, visibleOnly) {
      if (item) {
        if (item.children && item.children.length > 0) {
          let children = item.children;
          if (visibleOnly) children = children.filter((c) => c.show);
          return children[0];
        } else {
          return item;
        }
      }
    },
    childrenAndGrandchildren(parent) {
      let items = [];
      let children = parent.children.filter((child) => child.show);
      for (let child of children) {
        if (child.children) {
          items = items.concat(child.children);
        } else items.push(child);
      }
      return items;
    },
    flattenList(list) {
      let flatList = [];

      list.forEach((item) => {
        // Push the current item into the flat list
        flatList.push(item);

        // Check if the item has children
        if (item.children && item.children.length > 0) {
          // Flatten the children and concatenate with flat list
          flatList = flatList.concat(this.flattenList(item.children));
        }
      });

      return flatList;
    },
    /**
     * Returns the last path in the fullHistory that matches the item's name or the item's children's name
     */
    last(item) {
      if (item) {
        if (item.to) return item.to;
        let historyMatches = this.fullHistoryPathsByL1L2 || [];
        let namesToMatch = [item.name];
        if (item.children)
          namesToMatch = item.children.map((child) => child.name);
        historyMatches = historyMatches
          .filter((path) => path)
          .filter((path) => {
            let resolvedPath = this.$router.resolve(path);
            if (resolvedPath && resolvedPath.route) {
              if (resolvedPath.route.params && resolvedPath.route.params.l2) {
                if (this.$l2 && resolvedPath.route.params.l2 !== this.$l2.code)
                  return false; // Never go back to a different language!
              }
              if (namesToMatch.includes(resolvedPath.route.name)) {
                if (item.params) {
                  for (let key in item.params) {
                    if (resolvedPath.route.params?.[key] !== item.params[key])
                      return false;
                  }
                }
                return true;
              }
            }
          });
        let path = historyMatches.pop();
        return path;
      } else {
        return false;
      }
    },
    findParent(name) {
      let parent = this.menu.find((item) => {
        if (item.name === "index") return false;
        let nameOfItemOrFirstChild = this.nameOfSelfOrFirstChild(item, true);
        if (nameOfItemOrFirstChild && name === nameOfItemOrFirstChild)
          return true;
        let href = this.$router.resolve({
          name: nameOfItemOrFirstChild,
        }).href;
        if (nameOfItemOrFirstChild && this.$route.path.includes(href))
          return true;
        if (item.children) {
          for (let child of item.children) {
            if (child.name === name) return true;
            if (child.children) {
              for (let grandchild of child.children) {
                if (grandchild.name === name) return true;
              }
            }
          }
        }
      });
      return parent;
    },
  },
};
