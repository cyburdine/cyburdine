---
layout: default
title: CYBURDINE.com - [blog]
---
<!--
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
-->
<div class="glow">
<h3 style="color:#33ffcc">CYBURDINE.com :: [consiousness.stream]</h3>
<div class="search-bar">
  <input type="text" id="searchInput" placeholder="// enter query">
  <select id="tagFilter">
    <option value="">// all tags</option>
    {% assign all_tags = site.tags | sort %}
    {% for tag in all_tags %}
      <option value="{{ tag[0] }}">{{ tag[0] }}</option>
    {% endfor %}
  </select>
</div>

<ul id="postList">
  {% for post in site.posts %}
    <li class="post-item" data-tags="{{ post.tags | join: ',' }}">
      :: {{ post.date | date: "%y%m%d" }} - <a href="{{ post.url }}">{{ post.title }}</a> // tags: {{ post.tags | join: ', ' }}
    </li>
  {% endfor %}
</ul>
</div>