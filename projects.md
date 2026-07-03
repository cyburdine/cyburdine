---
layout: default
title: CYBURDINE.com - [projects]
---
<!--
SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
-->
<div class="glow">
<div class="search-bar">
  <input type="text" id="projectSearchInput" placeholder="// enter query">
  <div class="cy-select">
    <select id="projectTagFilter">
      <option value="">// all tags</option>
      {% assign all_tags = site.projects | map: "tags" | flatten | uniq | sort %}
      {% for tag in all_tags %}
        <option value="{{ tag }}">{{ tag }}</option>
      {% endfor %}
    </select>
  </div>
</div>

<div class="cy-cards" id="projectList">
  {% for project in site.projects %}
    {% include project-card.html project=project %}
  {% endfor %}
</div>
</div>
<script src="{{ '/assets/js/project_filter.js' | relative_url }}"></script>
