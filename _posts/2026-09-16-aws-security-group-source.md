---
layout: post
title: "AWS Security Group: Source 지정 방법과 실전 활용 (2)"
date: 2026-09-16
tags: [aws, vpc, security-group, prefix-list, alb, network, infra]
categories: [aws]
---

[지난 글](/2026/09/16/aws-security-group/)에서 Security Group의 기본 개념과 Stateful한 동작 방식을 정리했다. 이번 글에서는 Security Group의 **Source**를 지정하는 세 가지 방법 — CIDR, Prefix List, 다른 Security Group 참조 — 과 실전에서 이 개념이 어떻게 쓰이는지를 다룬다. NACL은 다음 글로 넘긴다.

## Security Group의 Source, 세 가지 방법

Security Group의 인바운드 규칙에서 트래픽이 오는 출발지(Source)는 세 가지 방식으로 지정할 수 있다.

- **IP 레인지(CIDR)**: 지금까지 써온 가장 기본적인 방식
- **Prefix List**: 여러 CIDR 블록을 하나로 묶어놓은 목록
- **다른 Security Group**: 특정 IP가 아니라 "이 보안그룹을 통과한 트래픽"을 허용

뒤의 두 가지가 실무에서 꽤 자주 쓰인다.

## Prefix List: 여러 CIDR을 하나로 묶어서 참조하기

Prefix List는 하나 이상의 CIDR 블록 집합이다. Security Group이나 Route Table에서 여러 대상을 한 번에 참조하고 싶을 때 쓴다. 두 종류로 나뉜다.

| 구분 | 고객 관리형 (Customer-managed) | AWS 관리형 (AWS-managed) |
|---|---|---|
| 생성·수정·삭제 | 직접 가능 | 불가능 (AWS가 관리) |
| 다른 계정과 공유 | 가능 | 해당 없음 |
| 예시 | 사내 개발자 IP 목록 | S3, DynamoDB, CloudFront의 IP 대역 |

![Prefix List 개념: 고객 관리형과 AWS 관리형](/assets/images/aws-security-group-source/sg_prefix_list.png)

세계 각지에 있는 사내 개발자들의 IP를 EC2와 RDS 양쪽 보안그룹에서 허용하고 싶다고 해보자. Prefix List 없이는 개발자 IP가 추가될 때마다 두 보안그룹을 각각 수정해야 한다. 대신 Prefix List를 하나 만들어서 두 보안그룹이 이걸 참조하게 해두면, 목록 하나만 업데이트해도 참조하는 모든 보안그룹에 자동으로 반영된다.

AWS 관리형 Prefix List는 S3, DynamoDB, CloudFront처럼 AWS 서비스의 IP 대역을 담고 있다. 이 IP들은 AWS 내부적으로 계속 바뀌는데, AWS 관리형 Prefix List를 참조해두면 IP가 바뀌어도 AWS가 자동으로 갱신해주기 때문에 직접 신경 쓸 필요가 없다.

몇 가지 제약도 있다. 하나의 Prefix List에는 IPv4 또는 IPv6 중 하나만 담을 수 있고(혼용 불가), 생성 시점에 최대 항목 수를 지정해야 한다(이후 변경은 가능하다).

## Security Group 참조: IP 대신 보안그룹 자체를 Source로

두 번째 방법은 Source에 IP 대신 다른 Security Group을 지정하는 것이다. "이 보안그룹을 통과한 모든 트래픽을 허용하겠다"는 선언이다.

이게 왜 유용한지는 Auto Scaling Group을 생각해보면 명확하다. EC2 인스턴스는 재부팅되거나 새로 생성될 때마다 IP가 바뀔 수 있고, Auto Scaling으로 인스턴스 개수 자체도 계속 바뀐다. IP를 하나씩 등록하는 방식이라면 바뀔 때마다 규칙을 다시 손봐야 한다. 대신 그 인스턴스들이 속한 Security Group 자체를 참조하면, 안에 있는 인스턴스의 IP가 어떻게 바뀌든 신경 쓸 필요가 없다.

## 실전 예시: ALB 뒤의 EC2, 직접 접근은 막고 로드밸런서로만 받기

Security Group 참조가 실제로 어떻게 쓰이는지 대표적인 예시로 확인해보자. 로드밸런서(ALB)와 Auto Scaling Group으로 구성된 아키텍처에서, 사용자가 로드밸런서를 우회해 EC2 인스턴스에 직접 접근하는 걸 막고 싶다고 하자.

![ALB-SG를 참조하는 EC2-SG 구조](/assets/images/aws-security-group-source/sg_reference_alb.png)

구성은 이렇다.

1. **ALB-SG** 생성: 인바운드로 HTTP(80)를 `0.0.0.0/0`(모든 곳)에서 허용
2. **EC2-SG** 생성: 인바운드로 모든 트래픽을 허용하되, Source를 IP가 아니라 **ALB-SG로 지정**
3. ALB에는 ALB-SG를, EC2 인스턴스에는 EC2-SG를 각각 적용

이렇게 구성하면 ALB를 거쳐 들어오는 트래픽은 EC2-SG를 통과하지만, EC2의 Public DNS로 직접 접근을 시도하면 차단된다. ALB의 IP는 원래 계속 바뀌기 때문에 IP 기준으로 허용 규칙을 만드는 건 애초에 불가능한데, ALB-SG를 참조하는 방식이면 ALB의 IP가 무엇이든 상관없이 "ALB-SG를 통과한 트래픽"이라는 조건만으로 걸러낼 수 있다.

실제 프로덕션 환경이라면 SSH 같은 관리용 포트는 이렇게 전부 열어두지 않고 별도로 제한하는 게 맞지만, 기본 개념을 확인하는 데모 수준에서는 이 정도 구성으로 충분하다.

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Prefix List** | 하나 이상의 CIDR 블록을 묶어놓은 목록. Security Group·Route Table에서 참조 |
| **고객 관리형 Prefix List** | 사용자가 직접 생성·수정·삭제하며 다른 계정과 공유 가능 |
| **AWS 관리형 Prefix List** | AWS 서비스(S3, DynamoDB, CloudFront 등)의 IP 대역. 수정 불가, 자동 갱신 |
| **Security Group 참조** | Source를 IP 대신 다른 Security Group으로 지정하는 방식. IP 변경에 영향받지 않음 |
| **ALB-SG / EC2-SG 패턴** | 로드밸런서만 EC2에 접근할 수 있도록 EC2-SG의 Source를 ALB-SG로 지정하는 구성 |

다음 글에서는 NACL의 Stateless한 동작 방식과, Security Group·NACL 전체 비교를 정리한다.
