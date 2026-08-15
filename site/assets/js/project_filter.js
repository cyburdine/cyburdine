/* SPDX-FileCopyrightText: © 2025 Justin Burdine <justin@cyburdine.com>
SPDX-License-Identifier: BSD-3-Clause
*/
document.addEventListener("DOMContentLoaded", function() {
  const searchInput = document.getElementById("projectSearchInput");
  const tagFilter = document.getElementById("projectTagFilter");
  const items = Array.from(document.querySelectorAll(".project-item"));

  function filterProjects() {
    const query = searchInput.value.trim().toLowerCase();
    const selectedTag = tagFilter.value;
    items.forEach(item => {
      const textMatch = item.textContent.toLowerCase().includes(query);
      const tags = item.getAttribute("data-tags");
      const tagMatch = !selectedTag || (tags && tags.split(",").includes(selectedTag));
      item.style.display = (textMatch && tagMatch) ? "" : "none";
    });
  }

  searchInput.addEventListener("input", filterProjects);
  tagFilter.addEventListener("change", filterProjects);
});