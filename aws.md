---
layout: page
title: AWS
permalink: /aws/
---

<div style="margin-bottom: 1.5rem;">
  <span style="font-family:'SFMono-Regular', Consolas, Menlo, monospace; font-size:13px; color:var(--accent);">$ ls aws/</span>
</div>

{% assign all_posts = site.categories.aws | sort: 'date' | reverse %}

<ul class="post-list" id="aws-post-list">
{% for post in all_posts %}
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

<script src="{{ '/assets/js/pagination.js' | relative_url }}"></script>
<script>initPagination('aws-post-list', 10);</script>

<p><a href="{{ '/' | relative_url }}">← 전체 글로 돌아가기</a></p>
