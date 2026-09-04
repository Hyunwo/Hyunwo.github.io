---
layout: page
title: Kubernetes
permalink: /kubernetes/
---

<div style="margin-bottom: 1.5rem;">
  <span style="font-family:'SFMono-Regular', Consolas, Menlo, monospace; font-size:13px; color:var(--accent);">$ ls kubernetes/</span>
</div>

<ul class="post-list">
{% assign k8s_posts = site.categories.kubernetes | sort: 'date' | reverse %}
{% for post in k8s_posts %}
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

<p><a href="{{ '/' | relative_url }}">← 전체 글로 돌아가기</a></p>
