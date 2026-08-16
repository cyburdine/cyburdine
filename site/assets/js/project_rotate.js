/*
SPDX-FileCopyrightText: © 2026 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause

Rotates which project holds the feature slot on projects.html, so the page
leads with something different each load rather than always the same build.

Contract (mirrors the comment in projects.html):
  - Every project is authored with IDENTICAL markup. `cy-feature` vs `cy-tile`
    on the <article> is the ONLY difference between the hero and a grid tile,
    which is what makes promotion a node move plus a class swap.
  - An article carrying `data-cy-rotate` is eligible for the feature slot.
    Exactly one article starts as `cy-feature` in the HTML; that is also the
    no-JS result, so the page is complete without this script.
  - The picked article is swapped IN PLACE with the current feature, so the
    featured build never also appears in the grid below.

This runs inline during parse, immediately after the markup it touches, so the
DOM is settled before render.js walks <main> and types the page out. Unlike the
project_filter.js it replaced, it no-ops rather than throwing when its elements
are absent, so it is harmless if it ever loads on another page.
*/
(function () {
  var feature = document.querySelector('.cy-cards .cy-feature');
  if (!feature) return;

  var pool = [feature];
  var eligible = document.querySelectorAll('.cy-cards [data-cy-rotate]');
  for (var i = 0; i < eligible.length; i++) {
    if (eligible[i] !== feature) pool.push(eligible[i]);
  }
  /* Nothing to rotate between: leave the authored feature alone. */
  if (pool.length < 2) return;

  var pick = pool[Math.floor(Math.random() * pool.length)];
  if (pick === feature) return;

  /* Swap the two nodes by leaving a marker at each position first — the two
     live in different containers (the hero sits outside .cy-tiles), so a
     straight insertBefore of one would move the other's reference point. */
  var featureMark = document.createComment('feature-slot');
  var pickMark = document.createComment('tile-slot');
  feature.parentNode.insertBefore(featureMark, feature);
  pick.parentNode.insertBefore(pickMark, pick);
  featureMark.parentNode.replaceChild(pick, featureMark);
  pickMark.parentNode.replaceChild(feature, pickMark);

  feature.classList.remove('cy-feature');
  feature.classList.add('cy-tile');
  pick.classList.remove('cy-tile');
  pick.classList.add('cy-feature');

  /* The promoted image is now above the fold; the demoted one no longer is. */
  var promoted = pick.querySelector('.cy-project__img');
  var demoted = feature.querySelector('.cy-project__img');
  if (promoted) promoted.setAttribute('loading', 'eager');
  if (demoted) demoted.setAttribute('loading', 'lazy');
})();
