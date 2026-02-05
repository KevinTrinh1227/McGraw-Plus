<p align="center">
  <img src="https://raw.githubusercontent.com/KevinTrinh1227/McGrawHill-SmartBook-Solver/refs/heads/main/src/assets/logo.png" alt="McGraw-Hill SmartBook Solver Logo" width="120" height="120">
</p>

<h1 align="center">McGraw-Hill SmartBook Solver</h1>

<p align="center">
  <em>
    A browser extension that automates McGraw-Hill SmartBook Concept assignments — fully offline, fast, and lightweight. Built as an <strong>educational experiment</strong> in DOM automation and browser extension development.
  </em>
</p>

<div align="center">

  <img src="https://img.shields.io/github/downloads/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/total?color=brightgreen&label=Downloads&style=for-the-badge" alt="Downloads" />
  <img src="https://img.shields.io/github/v/release/KevinTrinh1227/McGraw-Hill-SmartBook-Solver?color=orange&label=Latest%20Release&style=for-the-badge" alt="Release" />
  <img src="https://img.shields.io/github/last-commit/KevinTrinh1227/McGraw-Hill-SmartBook-Solver?color=yellow&label=Last%20Updated&style=for-the-badge" alt="Last Updated" />

</div>

<p align="center">
  <a href="https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest/download/McGraw-Hill-SmartBook-Solver.zip">
    <img src="https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/refs/heads/main/src/assets/demo_1.gif"
         alt="Demo of McGraw-Hill SmartBook Solver" width="850px">
  </a>
</p>

<details>
  <summary align="center"><strong>VIEW MORE DEMO EXAMPLES</strong></summary>
  <br>
  <p align="center">
    <a href="https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest/download/McGraw-Hill-SmartBook-Solver.zip">
      <img src="https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/refs/heads/main/src/assets/demo_2.gif"
           alt="Demo 2" width="850px">
    </a>
  </p>
  <p align="center">
    <a href="https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases/latest/download/McGraw-Hill-SmartBook-Solver.zip">
      <img src="https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/refs/heads/main/src/assets/demo_3.gif"
           alt="Demo 3" width="850px">
    </a>
  </p>
</details>

---

<p align="center">
  <a href="#about"><strong>About</strong></a> ·
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#installation-and-usage-guide"><strong>Installation</strong></a> ·
  <a href="#how-to-use"><strong>Usage</strong></a> ·
  <a href="#auto-updates"><strong>Auto-Updates</strong></a> ·
  <a href="#reporting-issues"><strong>Issues</strong></a> ·
  <a href="https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/blob/main/DISCLAIMER.MD"><strong>Disclaimer</strong></a>
</p>

---

## About <a id="about"></a>

The **McGraw-Hill SmartBook Solver** is a lightweight browser extension that automatically progresses through **SmartBook Concept Assignments** — answering questions until completion. It identifies correct answers, stores them locally, and reuses them on repeat encounters.

Since SmartBook Concept Assignments are **participation-based** (graded on completion, not accuracy), the extension first guesses randomly, then **reuses correct answers from local memory** to simulate progressive mastery.

This project exists purely as an **educational exploration** of web automation, DOM scripting, and Chrome extension development. It was never published to the Chrome Web Store.

**Compatible with all Chromium-based browsers:** Chrome, Edge, Brave, Opera, Vivaldi, Arc, Opera GX, and more.

---

## Features <a id="features"></a>

- **Auto-completes SmartBook concepts** — multiple choice, fill-in-the-blank, and drag-and-drop
- **Local answer storage** — learns answers and reuses them, no external API calls
- **Clean popup interface** with real-time status
- **Auto-update notifications** — checks GitHub Releases for new versions
- **Lightweight and secure** — runs entirely offline with zero data collection
- **Self-healing loop** — recovers from errors and context invalidation

---

## Installation <a id="installation-and-usage-guide"></a>

### Option 1 — Download Release (Recommended)

1. Download the latest `.zip` from the [Releases Page](https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/releases)
2. Extract the zip anywhere on your computer
3. Open `chrome://extensions` and enable **Developer Mode** (top right toggle)
4. Click **Load unpacked** and select the extracted `src/` folder
5. Pin the extension to your toolbar for easy access

### Option 2 — Clone via Git

```bash
git clone https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver.git
cd McGraw-Hill-SmartBook-Solver
```

Then load the `src/` folder as an unpacked extension (same steps 3-5 above).

---

## How to Use <a id="how-to-use"></a>

1. Open a **McGraw-Hill SmartBook** chapter concepts assignment and begin questions
2. Click the extension icon in your browser toolbar
3. Read and acknowledge the one-time disclaimer (checkbox + continue)
4. Click **Activate Bot** to start

<details>
  <summary><strong>View popup screenshot</strong></summary>
  <br>
  <p align="center">
    <img src="https://raw.githubusercontent.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/refs/heads/main/src/assets/home_switch.gif"
         alt="Home UI Switch" width="450px">
  </p>
</details>

> Toggle off at any time to stop the bot. The extension must be on a McGraw-Hill page for the toggle to be enabled.

---

## Auto-Updates <a id="auto-updates"></a>

The extension automatically checks for new releases every 6 hours by polling the GitHub Releases API. When a newer version is found:

- A green **update banner** appears in the popup with a download link
- The extension icon shows a `!` badge
- You can dismiss the banner (it won't re-show for the same version)

To update: download the new release, replace your local files, and reload the extension on `chrome://extensions`.

---

## Reporting Issues <a id="reporting-issues"></a>

Found a bug or have a suggestion? Open an issue on GitHub:

[**Open an Issue**](https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/issues)

---

## Disclaimer

This project is built solely for **educational and demonstration purposes**. It should never be used to bypass coursework or violate academic integrity policies.

By using this extension, you acknowledge:

- This tool should **not** be used on graded coursework, quizzes, or exams
- You are **solely responsible** for how you use this extension
- The developer is **not affiliated** with McGraw-Hill Education
- The developer assumes **no liability** for misuse or academic consequences

[**View Full Disclaimer**](https://github.com/KevinTrinh1227/McGraw-Hill-SmartBook-Solver/blob/main/DISCLAIMER.MD) · [**McGraw-Hill Terms of Use**](https://www.mheducation.com/about-us/policy-center/terms-use)

This repository does not provide, distribute, or endorse any copyrighted McGraw-Hill content.
