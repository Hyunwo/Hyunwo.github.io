---
layout: page
title: Kubernetes (2)
permalink: /kubernetes/page2/
---

<div style="margin-bottom: 1.5rem;">
  <span style="font-family:'SFMono-Regular', Consolas, Menlo, monospace; font-size:13px; color:var(--accent);">$ ls kubernetes/ --page 2</span>
</div>

{% assign per_page = 10 %}
{% assign all_posts = site.categories.kubernetes | sort: 'date' | reverse %}
{% assign total = all_posts | size %}
{% assign page_posts = all_posts | slice: per_page, per_page %}

<ul class="post-list">
{% for post in page_posts %}
  <li>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
    {% if site.show_excerpts %}{{ post.excerpt }}{% endif %}
  </li>
{% endfor %}
</ul>

<p style="display:flex; justify-content:space-between;">
  <a href="{{ '/kubernetes/' | relative_url }}">← 이전 페이지</a>
  {% assign next_offset = per_page | times: 2 %}
  {% if total > next_offset %}
  <a href="{{ '/kubernetes/page3/' | relative_url }}">다음 페이지 →</a>
  {% endif %}
</p>

<p><a href="{{ '/' | relative_url }}">← 전체 글로 돌아가기</a></p>
