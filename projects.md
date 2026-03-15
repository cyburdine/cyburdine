---
layout: default
title: CYBURDINE.com - [projects]
---
<!--
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
-->
<div class="glow">
<h3 style="color:#33ffcc">CYBURDINE.com :: [forge.node]</h3>
<div class="search-bar">
  <input type="text" id="projectSearchInput" placeholder="// enter query">
  <select id="projectTagFilter">
    <option value="">// all tags</option>
    {% assign all_tags = site.projects | map: "tags" | flatten | uniq | sort %}
    {% for tag in all_tags %}
      <option value="{{ tag }}">{{ tag }}</option>
    {% endfor %}
  </select>
</div>

<ul id="projectList">
  {% for project in site.projects %}
    <li class="project-item" data-tags="{{ project.tags | join: ',' }}">
      <a href="{{ project.url }}">{{ project.title }}</a>{% if project.tags %} // tags: {{ project.tags | join: ', ' }}{% endif %}
    </li>
  {% endfor %}
</ul>
</div>
<script src="{{ '/assets/js/project_filter.js' | relative_url }}"></script>

