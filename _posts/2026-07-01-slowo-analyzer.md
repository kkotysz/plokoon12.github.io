---
title: "Słowo Analyzer: a WordleBot-lite for Polish Wordle"
date: 2026-07-01T12:00:00+02:00
categories:
  - blog
  - technology
tags:
  - slowo
  - wordle
  - solver
  - react
  - typescript
  - pwa
---

I have added a new little project to this site: **Słowo Analyzer**, a browser-based assistant for analysing strategies in the Polish version of Wordle.

[Open Słowo Analyzer](/slowo-analyzer/){: .btn .btn--primary}
[View the source on GitHub](https://github.com/kkotysz/slowo-analyzer){: .btn .btn--info}

## What does it do?

The analyzer can be used in two ways:

- **Simulation with a known answer** automatically calculates the familiar green, yellow and grey tiles after each guess.
- **Manual analysis** lets you reproduce a game in progress by setting the tile colours yourself.

After every move, the app filters the remaining candidates and ranks possible next guesses. The ranking includes entropy, worst-case and average bucket size, the chance of an immediate hit and the estimated average number of moves required to finish.

A *bucket* is simply a group of answers that would produce the same colour pattern for a given guess. A good move should split the remaining words into small buckets, making the next decision easier even when it does not hit the answer immediately.

## Explore strategies

The game history shows how quickly each guess reduced the candidate list. You can return to an earlier move and try another path without rebuilding the whole game.

There is also a starting-word solver. Give it an opening word and a move limit, and it will test the resulting strategy against the answer dictionary. The histogram shows how many games are solved in one, two, three or more attempts.

The dictionary combines five-letter forms from **SJP.PL** with the **KWJP100** frequency lists and morphological data from **PoliMorf**. A filter hides unlikely inflected forms by default, while keeping them available when needed.

## Built for the browser

Słowo Analyzer is a static **React** and **TypeScript** application built with **Vite**. Ranking and solver calculations run in a Web Worker, so the interface remains responsive while more expensive strategies are evaluated. The app stores its dictionary cache and preferences locally and can work offline after the first visit.

Everything runs in the browser—there is no account, no backend and no game data sent to a server.

[Try Słowo Analyzer](/slowo-analyzer/){: .btn .btn--primary}
