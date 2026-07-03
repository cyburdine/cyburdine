---
layout: default
title: CYBURDINE.com - [blog]
---
<!--
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
-->
<div class="glow">
<div class="search-bar">
  <input type="text" id="searchInput" placeholder="// enter query">
  <div class="cy-select">
    <select id="tagFilter">
      <option value="">// all tags</option>
      {% assign all_tags = site.tags | sort %}
      {% for tag in all_tags %}
        <option value="{{ tag[0] }}">{{ tag[0] }}</option>
      {% endfor %}
    </select>
  </div>
</div>

<div class="cy-cards" id="postList">
  {% for post in site.posts %}
    {% include post-card.html post=post %}
  {% endfor %}
</div>
</div>
<script src="{{ '/assets/js/blog_filter.js' | relative_url }}"></script>
