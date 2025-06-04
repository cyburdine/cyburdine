---
layout: default
title: CYBURDINE.com - [projects]
---

<h3 style="color:#33ffcc">CYBURDINE.com :: [forge.node]</h3>
<ul>
  {% for project in site.projects %}
    <li><a href="{{ project.url }}">{{ project.title }}</a></li>
  {% endfor %}
</ul>
