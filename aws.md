---
layout: page
title: AWS
permalink: /aws/
---

<div style="margin-bottom: 1.5rem;">
  <span style="font-family:'SFMono-Regular', Consolas, Menlo, monospace; font-size:13px; color:var(--accent);">$ ls aws/</span>
</div>

{% assign per_page = 10 %}
{% assign all_posts = site.categories.aws | sort: 'date' | reverse %}
{% assign total = all_posts | size %}
{% assign remaining = total | minus: per_page %}

<ul class="post-list" id="aws-post-list">
{% for post in all_posts %}
  <li{% if forloop.index > per_page %} class="hidden-post" style="display:none;"{% endif %}>
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

{% if total > per_page %}
<p style="text-align:center; margin-top:1.5rem;">
  <button id="aws-load-more" style="background:transparent; border:1px solid #c9c9c9; color:#4a4a4a; font-size:13px; padding:8px 20px; border-radius:6px; cursor:pointer;">더보기 ({{ remaining }}개 더)</button>
</p>
<script>
document.getElementById('aws-load-more').addEventListener('click', function () {
  document.querySelectorAll('#aws-post-list .hidden-post').forEach(function (el) {
    el.style.display = '';
    el.classList.remove('hidden-post');
  });
  this.style.display = 'none';
});
</script>
{% endif %}

<p><a href="{{ '/' | relative_url }}">← 전체 글로 돌아가기</a></p>
