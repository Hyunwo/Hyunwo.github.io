---
layout: page
title: Kubernetes
permalink: /kubernetes/
---

<div style="margin-bottom: 1.5rem;">
  <span style="font-family:'SFMono-Regular', Consolas, Menlo, monospace; font-size:13px; color:var(--accent);">$ ls kubernetes/</span>
</div>

{% assign all_posts = site.categories.kubernetes | sort: 'date' | reverse %}

<ul class="post-list" id="k8s-post-list">
{% for post in all_posts %}
  <li>
    <span class="post-meta">{{ post.date | date: "%b %-d, %Y" }}</span>
    <h3>
      <a class="post-link" href="{{ post.url | relative_url }}">
        {{ post.title | escape }}
      </a>
    </h3>
    {% if post.description %}<p style="margin:4px 0 0; font-size:14px; color:#5a5a5a;">{{ post.description }}</p>{% elsif site.show_excerpts %}{{ post.excerpt }}{% endif %}
  </li>
{% endfor %}
</ul>

<script src="{{ '/assets/js/pagination.js' | relative_url }}"></script>
<script>initPagination('k8s-post-list', 10);</script>

<p><a href="{{ '/' | relative_url }}">← 전체 글로 돌아가기</a></p>
