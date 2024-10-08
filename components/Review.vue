<template>
  <div
    :class="{
      review: true,
      'show-answer': showAnswer,
      wrong,
      'review-light': skin === 'light',
      'review-dark': skin === 'dark',
    }"
    style="position: relative"
  >
    <div
      class="review-item"
      :dir="$l2.direction"
      :class="{
        'text-right':
          $l2.scripts &&
          $l2.scripts.length > 0 &&
          $l2.scripts[0].direction === 'rtl',
      }"
    >
      <div class="smiley-line-wrapper">
        <div class="smiley">
          <img
            src="/img/face-happy.gif"
            alt=""
            style="width: 100%"
            v-if="showAnswer"
          />
          <img
            src="/img/face-surprise.gif"
            alt=""
            style="width: 100%"
            v-else-if="wrong"
          />
          <img src="/img/face-straight.gif" alt="" style="width: 100%" v-else />
        </div>
        <div class="line-wrapper">
          <TokenizedRichText tag="span" :showMenu="true" class="transcript-line-l2">
            <span v-html="highlightedQuestionText"></span>
          </TokenizedRichText>
          <div
            :dir="$l1.direction === 'rtl' ? 'rtl' : 'ltr'"
            :class="{
              'transcript-line-l1 text-left mt-2': true,
              'text-right':
                $l1.scripts &&
                $l1.scripts.length > 0 &&
                $l1.scripts[0].direction === 'rtl',
            }"
            style="opacity: 0.7"
          >
            <span
              v-if="$l2.code !== $l1.code && reviewItem.parallelLines"
              v-html="reviewItem.parallelLines"
            />
            <b-button class="ml-1 btn-small" style="border: 1px solid #ccc" variant="light"  @click="scrollToLine">
              <i class="fa-solid fa-rotate-left"></i> Seek Video to Line
            </b-button>
          </div>
        </div>
      </div>
      <div class="mt-2" v-if="answers">
        <ReviewAnswerButton
          v-for="(answer, index) in answers"
          :key="`quiz-button-${index}`"
          :answer="answer"
          :skin="skin"
          @answered="answered(answer)"
        />
      </div>
    </div>
  </div>
</template>

<script>
import { distance } from "fastest-levenshtein";
import { mapState } from "vuex";
import { uniqueByValue, shuffle, SpeechSingleton, timeout, highlightMultiple, highlight, unique } from "../lib/utils";

export default {
  data() {
    return {
      answers: undefined,
      showAnswer: false,
      s: [],
      wrong: false,
    };
  },
  computed: {
    ...mapState("savedWords", ["savedWords"]),
    highlightedQuestionText() {
      let html;
      if (this.$l2.han && this.$l2.code !== 'ja') {
        html = highlightMultiple(
          this.reviewItem.line.line,
          unique([this.reviewItem.simplified, this.reviewItem.traditional]),
          this.hsk
        );
      } else {
        html = highlight(this.reviewItem.line.line, this.reviewItem.text, this.reviewItem.hsk);
      }
      console.log(html);
      return html;
    },
  },
// 
// text: savedForm,
// word: savedWord,

  props: {
    reviewItem: {
      type: Object,
      required: true,
    },
    hsk: {
      default: "outside",
    },
    skin: {
      default: "light",
    },
  },
  async mounted() {
    this.answers = await this.generateAnswers(this.reviewItem.text, this.reviewItem.word);
  },
  methods: {
    scrollToLine() {
      this.$emit("goToLine", this.reviewItem.line);
    },
    /**
     * Find similar words (but not identical) to the target surface form `text` as confounds.
     * @param {string} text - The target surface form
     * @returns {Array} - An array of similar words
     */
    async findSimilarWords(text) {
      // Initialize an empty array to store the similar words
      let words = [];

      // Get the saved words for the current language
      let savedWords = this.savedWords[this.$l2.code] || [];

      // Fetch the dictionary
      const dictionary = await this.$getDictionary();

      // If there are more than one saved words, use them to find similar words as confounds
      if (savedWords.length > 1) {
        // Calculate the distance between each saved word and the target word's surface form 'text'
        savedWords = savedWords.map((s) =>
          Object.assign(
            {
              distance: distance(
                s.forms[0] || s.simplified,
                text
              ),
            },
            s
          )
        );

        // Filter, sort, and limit the saved words based on their distance to the target word's surface form 'text'
        savedWords = savedWords
          .filter((w) => w.forms && w.forms[0])
          .sort((a, b) => a.distance - b.distance)
          .slice(0, 2);

        // Fetch the full details of each saved word from the dictionary and add them to the words array
        for (let w of savedWords) {
          let word = await dictionary.get(w.id);
          words.push(word);
        }
      } else {
        // If there are not enough saved words, perform a fuzzy lookup in the dictionary
        words = await dictionary.lookupFuzzy(text);

        // Sort the words based on their distance to the input text
        words = words.sort(
          (a, b) =>
            distance(a.head, text) -
            distance(b.head, text)
        );
      }

      // Filter out the input text and duplicate words from the words array
      words = words.filter(
        (word) =>
          word && word.head && word.head.toLowerCase() !== text.toLowerCase()
      );

      // For learners of Chinese, Korean, and Japanese, we need to consider different forms of characters.
      // We don't know if the target word `text` is in simplified, traditional, hangul, or kana form.
      // So, we exclude words that match `text` in any of these forms.
      if (["zh", "ko", "ja"].includes(this.$l2.code)) {
        words = words.filter(
          (word) =>
            word &&
            (!word.head || word.head !== text) &&
            (!word.simplified || word.simplified !== text) &&
            (!word.traditional || word.traditional !== text) &&
            (!word.hangul || word.hangul !== text) &&
            (!word.kana || word.kana !== text)
        );
      }

      words = uniqueByValue(words, "head");

      // Return the words array
      return words;
    },
    async generateAnswers(form, word) {
      const dictionary = await this.$getDictionary();

      // Find words similar to the given form
      let similarWords = await this.findSimilarWords(form);

      // If less than 2 similar words are found, add random words from the dictionary
      if (similarWords.length < 2) {
        for (let i of [1, 2]) {
          let randomWord = await dictionary.random();
          similarWords.push(randomWord);
        }
      }

      // Map the similar words to a new format and limit the array to 2 elements
      let answers = similarWords
        .map((similarWord) => {
          return {
            text: similarWord.head,
            simplified: similarWord.simplified,
            traditional: similarWord.traditional,
            correct: false,
          };
        })

      
      answers = answers.slice(0, 2);

      // Add the correct answer to the array
      answers.push({
        text: form,
        simplified: word.simplified,
        traditional: word.traditional,
        correct: true,
      });

      // Shuffle the answers array to randomize the order of the answers
      return shuffle(answers);
    },
    async speak() {
      if (this.reviewItem.parallelLines) {
        await SpeechSingleton.instance.speak(this.reviewItem.parallelLines, this.$l1, 1.1);
      }
      await SpeechSingleton.instance.speak(this.reviewItem.line.line, this.$l2, 1);
    },
    async answered(answer) {
      if (answer.correct) {
        this.showAnswer = true;
        this.wrong = false;
        let audio = new Audio("/audio/correct-ding.mp3");
        // play the audio but very quietly
        audio.volume = 0.01;
        audio.play();
      } else {
        this.wrong = false;
        await timeout(100);
        this.wrong = true;
      }
      this.reviewItem.answered = true;
      this.$emit("reviewItemAnswered", this.reviewItem);
    },
    highlightMultiple() {
      return highlightMultiple(...arguments);
    },
    highlight() {
      return highlight(...arguments);
    },
    unique() {
      return unique(...arguments);
    },
    updated() {
      this.showAnswer = false;
    },
  },
};
</script>

<style lang="scss" scoped>
.review {
  margin: 0.5rem 0;
  padding: 1rem;
  border: 1px solid #ffb7002b;
  border-radius: 0.5rem;
  background: #dea4171f;
  .review-speak-button,
  .review-seek-button {
    border-radius: 100%;
    width: 1.7rem;
    height: 1.7rem;
    display: inline-block;
    overflow: hidden;
    padding: 0;
    font-size: 0.8em;
  }
  :deep(.highlight) {
    display: inline-block;
    min-width: 5rem;
    text-align: center;
  }
  .transcript-line-l1 {
    font-size: 13.44px;
  }
  &:not(.show-answer) {
    :deep(.highlight) {
      margin: 0 0.2rem;
      position: relative;
      bottom: 0.2rem;
      color: #00000000 !important;
      border-bottom: 1px solid rgba(125, 125, 125, 0.5);
    }
    :deep(.transcript-line-l2) {
      .highlight {
        color: rgba(0, 0, 0, 0);
        * {
          opacity: 0;
          pointer-events: none;
        }
      }
    }
  }
  &.show-answer {
    background-color: #92ff9930;
    border: 1px solid #92ff9944;
  }
}

/* https://css-tricks.com/snippets/css/shake-css-keyframe-animation/ */
.wrong {
  animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  transform: translate3d(0, 0, 0);
  backface-visibility: hidden;
  perspective: 1000px;
}

@keyframes shake {
  10%,
  90% {
    transform: translate3d(-1px, 0, 0);
  }

  20%,
  80% {
    transform: translate3d(2px, 0, 0);
  }

  30%,
  50%,
  70% {
    transform: translate3d(-4px, 0, 0);
  }

  40%,
  60% {
    transform: translate3d(4px, 0, 0);
  }
}
.smiley-line-wrapper {
  display: flex;
  .smiley {
    margin-right: 0.5rem;
    margin-bottom: 0.5rem;
    height: 2rem;
    width: 2.5rem;
  }
  .line-wrapper {
    padding-left: 0.5rem;
    flex: 1;
  }
}
</style>