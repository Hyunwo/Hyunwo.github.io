---
layout: post
title: "AWS Security Group: 기본 개념과 Stateful (1)"
date: 2026-09-16
tags: [aws, vpc, security-group, network, infra]
categories: [aws]
---

[지난 글](/2026/09/11/aws-nat-gateway-bastion-host/)에서 아직 다루지 않은 보안 규칙으로 Security Group과 NACL이 남아 있다고 했다. 이번 글에서는 그중 Security Group을 정리한다. 강의 분량이 많아 이번 글은 Stateful 개념까지만 다루고, NACL과의 본격적인 비교는 다음 글에서 이어간다.

## Security Group: EC2 전용이 아니라 ENI 단위의 가상 방화벽

Security Group은 인스턴스에 대한 인바운드·아웃바운드 트래픽을 제어하는 가상 방화벽이다. EC2 수업 때 간단히 다뤘지만, 소속으로 따지면 VPC 쪽 리소스다. EC2 인스턴스에만 쓰는 게 아니라 RDS, Application Load Balancer 등 다양한 리소스에서 쓴다는 점도 알아둘 만하다.

정확히는 "인스턴스 단위"가 아니라 **ENI(Elastic Network Interface) 단위**로 적용된다. 지금 단계에서는 인스턴스 단위로 이해해도 무방하지만, 실제로는 ENI에 붙는다는 걸 기억해두면 나중에 헷갈리지 않는다.

## 허용만 가능하다: 명시하지 않으면 전부 차단

Security Group은 기본적으로 모든 포트가 비활성화되어 있다. 내가 명시적으로 허용한 포트와 소스(트래픽이 오는 출발지)만 통과할 수 있다. 여기서 중요한 제약이 하나 있는데, **Deny(거부)는 설정할 수 없고 Allow(허용)만 가능하다**는 점이다. 특정 포트나 소스를 명시적으로 차단하고 싶다면 Security Group으로는 안 되고, 다음 글에서 다룰 NACL을 써야 한다.

## 하나의 EC2에 여러 개 적용 가능

Security Group은 하나의 EC2(정확히는 ENI)에 하나 이상 동시에 적용할 수 있다. 이때 허용 규칙은 합집합으로 적용된다.

![보안그룹 다중 적용과 역할별 보안그룹](/assets/images/aws-security-group/sg_multiple_rules.png)

왼쪽처럼 보안그룹 A(443 허용)와 B(8080 허용)를 동시에 붙이면 443과 8080 모두 통과한다. 오른쪽처럼 Web 서버용 보안그룹(80, 443, 22 허용)과 DB 서버용 보안그룹(3306, 22 허용)을 역할별로 따로 두는 것도 흔한 패턴이다. 이 경우 8080처럼 어느 쪽에도 없는 포트는 당연히 차단된다 — Allow만 가능한 구조이기 때문이다.

## Security Group은 VPC 내부가 원칙

Security Group은 특정 VPC 안에서 생성되고 관리되며, 원칙적으로 그 VPC 바깥으로는 나가지 않는다. NACL이 Subnet 단위인 것과 달리, Security Group은 EC2(ENI) 단위라는 게 둘의 핵심 차이 중 하나다.

다만 여러 VPC에서 같은 Security Group을 재사용하고 싶은 경우를 위해 **VPC 간 보안 그룹 공유** 기능이 있다. 기본 VPC(Default VPC)에서는 사용할 수 없고, 다른 리전에 있는 VPC에는 공유할 수 없는 등 몇 가지 제약이 있다. 지금 단계에서는 이런 기능이 있다는 정도만 기억해두면 된다.

## Stateful: 들어온 트래픽에 대한 응답은 자동으로 나간다

방화벽에는 Stateful과 Stateless라는 두 가지 동작 방식이 있다. Security Group은 **Stateful**이고, 다음 글에서 다룰 NACL은 **Stateless**다.

이 둘의 차이를 이해하려면 먼저 통신에 쓰이는 두 종류의 포트를 알아야 한다. 서버가 쓰는 포트는 프로토콜마다 정해져 있다(HTTP는 80, HTTPS는 443). 이걸 **Well-known Port**라 부른다. 반대로 클라이언트가 쓰는 포트는 그 순간 사용하지 않는 포트 중 아무거나 무작위로 고른다. 이걸 **Ephemeral Port(임시 포트)**라 부르고, 매 통신마다 달라질 수 있다.

![Stateful과 Stateless 트래픽 흐름 비교](/assets/images/aws-security-group/sg_stateful_flow.png)

Security Group이 Stateful하다는 건, 인바운드로 들어온 트래픽을 기억해서 그에 대한 응답은 별도의 아웃바운드 설정 없이도 자동으로 내보내 준다는 뜻이다. 80번 포트로 들어오는 요청만 Inbound Allow로 열어두면, 그 요청에 대한 응답은 따로 아웃바운드 규칙을 만들지 않아도 나간다. 얼굴을 아는 손님을 알아보고 그냥 내보내주는 똑똑한 문지기에 가깝다.

반면 Stateless한 방화벽(NACL)은 인바운드와 아웃바운드를 각각 따로 체크한다. 인바운드로 80번을 허용해도, 그 응답이 나가려면 아웃바운드 규칙이 별도로 있어야 한다. 문제는 응답이 나갈 때 쓰는 포트가 클라이언트의 Ephemeral Port라 매번 달라진다는 점이다. 그래서 Stateless 환경에서는 포트 하나만 열어두는 게 아니라 Ephemeral Port 범위 전체를 아웃바운드로 열어둬야 한다. 이 부분은 NACL을 다루는 다음 글에서 더 자세히 살펴본다.

## 용어 정리

| 용어 | 설명 |
|---|---|
| **Security Group** | 인스턴스(정확히는 ENI) 단위로 적용되는 가상 방화벽. Allow만 가능 |
| **ENI** | Elastic Network Interface. Security Group이 실제로 적용되는 단위 |
| **VPC 간 보안그룹 공유** | 여러 VPC에서 하나의 Security Group을 재사용하는 기능. 기본 VPC·타 리전은 제약 있음 |
| **Stateful** | 인바운드로 들어온 트래픽의 응답을 별도 설정 없이 자동으로 내보내는 방식 (Security Group) |
| **Stateless** | 인바운드·아웃바운드를 각각 따로 체크하는 방식 (NACL) |
| **Well-known Port** | 프로토콜마다 고정된 포트 (HTTP 80, HTTPS 443 등) |
| **Ephemeral Port** | 클라이언트가 통신마다 무작위로 고르는 임시 포트 |

다음 글에서는 오늘 배운 Stateful 개념을 기준으로 NACL의 Stateless한 동작 방식과, Security Group·NACL의 전체 비교를 이어서 정리한다.
