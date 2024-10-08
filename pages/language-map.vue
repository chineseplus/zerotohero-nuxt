<template>
  <div style="display: flex; flex-direction: column; height: 100vh">
    <SocialHead
      :title="$tb('Map of World Languages') + '| Language Player'"
      :description="
        $tb(
          'Tap on any language label to learn the language! Live TV channels, TV shows with subtitles, music with lyrics, phrasebooks with video examples... everything that can help you to learn a language “by osmosis.”'
        )
      "
      image="/img/thumbnail-language-map-2.jpg"
    />
    <div
      :class="{
        'language-map-description': true,
        'language-map-description-collapsed': hideDescription,
      }"
    >
      <b-button
        variant="unstyled"
        class="btn-close"
        @click="hideDescription = !hideDescription"
      >
        <i class="fa-solid fa-xmark" v-if="!hideDescription"></i>
        <span v-else>{{ $tb("Show Legend") }}</span>
      </b-button>
      <h5 class="text-white">{{ $tb("World Language Map") }}</h5>
      <p class="text-white">
        <i class="fa-solid fa-arrow-pointer"></i>
        {{ $tb("Click on any language to learn it.") }}
      </p>
      <p v-if="filteredLangsWithGeo">
        {{
          $tb(
            "This is an interactive map of {numLanguages} languages of the world, including {livingLanguages} living languages, {historicLanguages} historic languages, {extinctLanguages} extinct languages, and {constructedLanguages} constructed languages.",
            {
              numLanguages: filteredLangsWithGeo.length,
              livingLanguages: livingLangs.length,
              historicLanguages: historicLangs.length,
              extinctLanguages: extinctLangs.length,
              constructedLanguages: constructedLangs.length,
            }
          )
        }}
      </p>

      <p v-else>
        {{
          $tb(
            "This is an interactive map of 7,268 languages of the world, including 6,924 living languages, 105 historic languages, 220 extinct languages, and 5 constructed languages."
          )
        }}
      </p>
      <p>
        <b class="text-white">{{ $tb("Legend.") }}</b>
        {{
          $tb(
            "Circle sizes correspond to speaker populations. Circles are colour-coded by language families."
          )
        }}
      </p>
      <ul class="list-unstyled">
        <li v-for="family in langFamilies" :key="`legend-family-${family.id}`">
          <span
            class="legend-dot"
            :style="`background-color: ${family.color};`"
          ></span>
          <span>{{ $tb(family.name) }}</span>
        </li>
      </ul>
      <!-- Add the slider control here -->
      <div class="slider-control">
        <span style="position: relative; bottom: 0.2rem;">Map Density</span>
        <input
          id="magicScaleSlider"
          type="range"
          min="0.1"
          max="5"
          step="0.1"
          v-model.number="magicScale"
        />
      </div>
    </div>
    <div class="container-fluid flex-1">
      <div class="row">
        <div class="col-12 p-0">
          <div class="loader-wrapper" v-if="loadingMap">
            <Loader
              :sticky="true"
              :message="
                $tb('Loading map, and plotting thousands of languages...')
              "
            />
          </div>
          <client-only v-if="filteredLangsWithGeo">
            <div class="options-bar">
              <LanguageSwitch
                style="flex: 1; z-index: 999; margin-left: 0.25rem"
                :placeholder="$tb('Search languages...')"
                :nav="false"
                :button="false"
                :showRandom="false"
                :langs="filteredLangs"
                @nav="onNav"
              />
            </div>
            <LanguageMap
              ref="languageMap"
              :langs="filteredLangsWithGeo"
              :key="`language-map-${languagesKey}`"
              :l1="l1"
              @ready="onReady"
              style="height: 100vh"
            />
          </client-only>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { timeout } from "../lib/utils";

export default {
  data() {
    return {
      l1: "en",
      hideDescription: false,
      loadingMap: true,
      filteredLangsWithGeo: undefined,
      filteredLangs: undefined,
      languagesKey: 0,
      langFamilies: [
        { id: "afro1255", name: "Afro-Asiatic", color: "#f8b51e" },
        { id: "atla1278", name: "Atlantic-Congo", color: "#fd4f1c" },
        { id: "aust1305", name: "Austroasiatic", color: "#5b0516" },
        { id: "aust1307", name: "Austronesian", color: "#6a3669" },
        { id: "drav1251", name: "Dravidian", color: "#28a745" },
        { id: "indo1319", name: "Indo-European", color: "#1b3e76" },
        { id: "nucl1709", name: "Nuclear Trans New Guinea", color: "#0076ba" },
        { id: "sino1245", name: "Sino-Tibetan", color: "#bb1718" },
        { id: "taik1256", name: "Tai-Kadai", color: "#b1c751" },
        { id: "turk1311", name: "Turkic", color: "#005f58" },
        { id: "", name: "Others", color: "#000" },
      ],
      magicScale: 2.2, // Initialize magicScale
    };
  },
  components: {
    LanguageMap: () => {
      if (process.client) {
        return import("@/components/LanguageMap.vue");
      }
    },
  },
  async mounted() {
    this.$store.commit("settings/SET_L1_L2_TO_NULL");
    await this.$languages.loadFull();
    await timeout(100);
    this.updateLanguages();
    if (window && window.innerWidth < 720) {
      this.hideDescription = true;
    }
  },
  watch: {
    l1() {
      this.updateLanguages();
    },
    magicScale(newScale) {
      this.$refs.languageMap.magicScale = newScale;
      this.$refs.languageMap.filterLanguages();
    },
  },
  computed: {
    livingLangs() {
      return this.filteredLangsWithGeo
        ? this.filteredLangsWithGeo.filter((l) => l.type === "L")
        : undefined;
    },
    historicLangs() {
      return this.filteredLangsWithGeo
        ? this.filteredLangsWithGeo.filter(
            (l) => l.type === "H" || l.type === "A"
          )
        : undefined;
    },
    extinctLangs() {
      return this.filteredLangsWithGeo
        ? this.filteredLangsWithGeo.filter((l) => l.type === "E")
        : undefined;
    },
    constructedLangs() {
      return this.filteredLangsWithGeo
        ? this.filteredLangsWithGeo.filter((l) => l.type === "C")
        : undefined;
    },
  },
  methods: {
    onReady() {
      this.loadingMap = false;
    },
    updateLanguages() {
      this.filteredLangs = this.getFilteredLangs();
      this.filteredLangsWithGeo = this.getFilteredLangsWithGeo();
      this.languagesKey++;
    },
    getFilteredLangs() {
      let languages = this.$languages.l1s;
      languages = languages.filter((l) => {
        if (l["iso639-3"] === "cmn") return false;
        if (l["iso639-3"] === "arb") return false;
        if (!l["iso639-3"]) return false;
        if (!(l.type === "L")) return false;
        if (!(l.speakers > 0)) return false;
        return true;
      });
      return languages;
    },
    getFilteredLangsWithGeo() {
      let languages = this.filteredLangs;
      languages = languages
        .filter((l) => {
          if (l.lat && l.long) return true;
        })
        .sort((a, b) => b.speakers - a.speakers);
      return languages;
    },
    hasDictionary(l1, l2) {
      return (
        this.$languages.hasFeature(l1, l2, "dictionary") || l2.code === "en"
      );
    },
    hasYouTube(l1, l2) {
      return this.$languages.hasYouTube(l1, l2) || l2.code === "en";
    },
    onNav(url, suggestion = undefined) {
      let l2;
      if (suggestion) {
        l2 = suggestion.l2;
      } else if (url) {
        let code = url.split("/")[2];
        l2 = this.$languages.getSmart(code);
      }
      if (l2) {
        if (l2.lat && l2.long) this.$refs.languageMap.goToLang(l2);
        else {
          let l1Code = this.l1;
          let path = `/${l1Code}/${l2.code}/language-info`;
          this.$router.push(path);
        }
      }
    },
  },
};
</script>

<style lang="scss" scoped>
.options-bar {
  position: fixed;
  width: calc(100vw - 2rem);
  top: calc(3.5rem + env(safe-area-inset-top));
  left: 1rem;
  z-index: 1001; // The map has a z-index of 1000
  display: flex;
}
.loader-wrapper {
  background: rgba(0, 0, 0, 0.66);
  backdrop-filter: blur(15px);
  -webkit-backdrop-filter: blur(15px);
  color: white;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
:deep(.leaflet-left) .leaflet-control {
  margin-top: 4rem;
  margin-left: 1rem;
}

:deep(.leaflet-right) .leaflet-control {
  margin-top: 4rem;
  margin-right: 1rem;
}

.language-map-description {
  position: fixed;
  width: 19.5rem;
  height: calc(
    100vh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 9rem - 1rem
  );
  background-color: #000000ee;
  right: 1rem;
  border-radius: 0.5rem;
  top: calc(env(safe-area-inset-top) + 9rem);
  padding: 1.5rem;
  z-index: 401;
  color: #aaa;
  overflow-y: auto;
  .btn-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    color: #666;
    font-size: 1.3em;
  }
  .legend-dot {
    height: 1rem;
    width: 1rem;
    display: inline-block;
    border: 1px solid #666;
    border-radius: 100%;
    margin-right: 0.5rem;
    position: relative;
    bottom: -0.15rem;
  }
  &.language-map-description-collapsed {
    height: auto;
    width: 5rem;
    padding: 0.25rem;
    .btn-close {
      font-size: 0.8em;
      position: static;
      color: white;
    }
    > *:not(button) {
      display: none;
    }
  }
}
.slider-control {
  margin-top: 20px;
  border-radius: 5px;
}
</style>
