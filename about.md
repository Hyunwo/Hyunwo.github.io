---
layout: page
title: About
permalink: /about/
---

<style>
.ab { --ab-ink:#1f2933; --ab-sub:#5f6b7a; --ab-line:#e4e8ee; --ab-soft:#f6f8fb; --ab-accent:#2f6fb5; color:var(--ab-ink); }
.ab h2 { font-size:1.15rem; margin:2.2rem 0 .9rem; padding-bottom:.45rem; border-bottom:1px solid var(--ab-line); letter-spacing:-.01em; }
.ab p { line-height:1.8; margin:0 0 .9rem; }
.ab-hero { background:linear-gradient(135deg,#eef4fb 0%,#f8fafc 100%); border:1px solid var(--ab-line); border-radius:14px; padding:28px 28px 24px; }
.ab-hero .name { font-size:1.7rem; font-weight:700; letter-spacing:-.02em; margin:0; }
.ab-hero .role { color:var(--ab-accent); font-weight:600; margin:.25rem 0 1rem; }
.ab-hero p { color:var(--ab-sub); margin:0; }
.ab-chips { display:flex; flex-wrap:wrap; gap:8px; margin:0; padding:0; list-style:none; }
.ab-chips li { font-size:.85rem; padding:4px 11px; border-radius:999px; background:#fff; border:1px solid var(--ab-line); color:#33404f; }
.ab-cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(230px,1fr)); gap:14px; }
.ab-card { border:1px solid var(--ab-line); border-radius:12px; padding:16px 18px; background:#fff; }
.ab-card .tag { font-size:.75rem; color:var(--ab-accent); font-weight:600; }
.ab-card h3 { font-size:1.05rem; font-weight:700; margin:.2rem 0 .5rem; }
.ab-card p { font-size:.9rem; line-height:1.65; color:var(--ab-sub); margin:0 0 .5rem; }
.ab-card ul { margin:.3rem 0 0 1.1rem; padding:0; font-size:.88rem; line-height:1.65; color:#33404f; }
.ab-card { display:flex; flex-direction:column; }
.ab-card .more { margin-top:auto; padding-top:12px; font-size:.85rem; font-weight:600; text-decoration:none; color:var(--ab-accent); }
.ab-card .more:hover { text-decoration:underline; }
.ab-tl { list-style:none; margin:0; padding:0; }
.ab-tl li { display:flex; gap:16px; padding:9px 0; border-bottom:1px dashed var(--ab-line); font-size:.95rem; }
.ab-tl .when { flex:0 0 84px; color:var(--ab-sub); font-size:.85rem; padding-top:2px; }
.ab-stack { display:grid; grid-template-columns:110px 1fr; gap:10px 14px; align-items:start; font-size:.92rem; }
.ab-stack .k { color:var(--ab-sub); padding-top:4px; }
.ab-links a { display:inline-block; margin:0 8px 8px 0; padding:7px 14px; border-radius:8px; border:1px solid var(--ab-line); background:var(--ab-soft); text-decoration:none; color:#33404f; font-size:.9rem; }
.ab-links a:hover { border-color:var(--ab-accent); color:var(--ab-accent); }
@media (max-width:520px){ .ab-hero{padding:22px 18px;} .ab-stack{grid-template-columns:1fr;} .ab-tl li{flex-direction:column;gap:2px;} .ab-tl .when{flex:none;} }
</style>

<div class="ab">

<div class="ab-hero">
  <p class="name">정현우</p>
  <p class="role">Cloud Infra &amp; DevOps</p>
  <p>클라우드 인프라 엔지니어를 목표로 공부하고 있습니다. 개념을 외우기보다 <em>왜 그렇게 동작하는지</em>를 이해하는 걸 좋아하고, 배운 내용은 제 말로 다시 풀어서 이 블로그에 기록합니다.</p>
  <ul class="ab-chips" style="margin-top:16px;">
    <li>Kubernetes</li><li>AWS</li><li>Terraform</li><li>Istio</li><li>ArgoCD</li>
  </ul>
</div>

<h2>요즘 하는 것</h2>

<p>쿠버네티스 강의를 정리한 뒤, 지금은 AWS 기초(VPC, 보안 그룹, S3 등)를 같은 방식으로 정리하고 있습니다. 강의 내용을 그대로 옮기기보다 최신 문서와 대조해 틀린 부분은 바로잡고, 직접 그린 구성도를 함께 넣는 것을 원칙으로 합니다. 글은 <a href="{{ '/kubernetes/' | relative_url }}">Kubernetes</a>와 <a href="{{ '/aws/' | relative_url }}">AWS</a> 탭에 모여 있습니다.</p>

<h2>프로젝트</h2>

<div class="ab-cards">
  <div class="ab-card">
    <span class="tag">KT Cloud Tech Up · 팀 15명</span>
    <h3>POP-CON</h3>
    <p>팝업스토어 예약 플랫폼. 클라우드 팀 2명 중 인프라 구축과 서비스 메시를 맡았습니다.</p>
    <ul>
      <li>Terraform 기반 AWS EKS 프로비저닝</li>
      <li>Istio, Karpenter 구성</li>
      <li>GitHub Actions → ArgoCD 배포 파이프라인</li>
      <li>EC2 스케줄러로 비용 약 76~79% 절감</li>
    </ul>
    <a class="more" href="https://github.com/Hyunwo/pop-con-infra">GitHub 레포 보기 ↗</a>
  </div>
  <div class="ab-card">
    <span class="tag">새싹 클라우드 아키텍트 · 팀 5명</span>
    <h3>Ticketaka</h3>
    <p>티켓 예매 서비스의 인프라 계층을 구성했습니다. 앱 코드는 기존 프로젝트를 기반으로 했습니다.</p>
    <ul>
      <li>Terraform + Karpenter + HPA 오토스케일링</li>
      <li>리전별 tfvars로 멀티 리전(서울·도쿄) 배포</li>
      <li>VPC·서브넷 등 전체 구조 설계 참여</li>
    </ul>
    <a class="more" href="https://github.com/Hyunwo/ticketaka-infra">GitHub 레포 보기 ↗</a>
  </div>
  <div class="ab-card">
    <span class="tag">새싹 중간 프로젝트 · 약 1개월</span>
    <h3>멀티 클라우드 Failover</h3>
    <p>AWS 장애 시 GCP로 트래픽이 넘어가는 구조를 설계했습니다.</p>
    <ul>
      <li>AWS 3-tier 아키텍처 설계</li>
      <li>Route 53 failover 라우팅</li>
      <li>AWS → GCP 일 단위 데이터 동기화 (RPO 24h)</li>
    </ul>
  </div>
</div>

<h2>자격과 교육</h2>

<ul class="ab-tl">
  <li><span class="when">2026.01</span><span>AWS Certified Solutions Architect – Associate (SAA-C03)</span></li>
  <li><span class="when">2024.09</span><span>정보처리기사</span></li>
  <li><span class="when">2024.07</span><span>Microsoft Azure Fundamentals (AZ-900)</span></li>
  <li><span class="when">2024.05</span><span>Microsoft Azure AI Fundamentals (AI-900)</span></li>
  <li><span class="when">교육</span><span>KT Cloud Tech Up 1기 · 새싹 클라우드 아키텍트 과정 수료</span></li>
  <li><span class="when">학력</span><span>컴퓨터공학 전공</span></li>
</ul>

<h2>기술 스택</h2>

<div class="ab-stack">
  <span class="k">Cloud</span>
  <ul class="ab-chips"><li>AWS</li><li>GCP</li><li>Azure</li></ul>
  <span class="k">Container</span>
  <ul class="ab-chips"><li>Kubernetes / EKS</li><li>Docker</li><li>Istio</li><li>Karpenter</li></ul>
  <span class="k">IaC · CI/CD</span>
  <ul class="ab-chips"><li>Terraform</li><li>ArgoCD</li><li>GitHub Actions</li></ul>
  <span class="k">Monitoring</span>
  <ul class="ab-chips"><li>Prometheus</li><li>Grafana</li></ul>
</div>

<h2>연락</h2>

<div class="ab-links">
  <a href="https://github.com/Hyunwo">GitHub ↗</a>
</div>

</div>
