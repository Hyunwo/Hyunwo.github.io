---
layout: post
title: "AWS VPC 파트 정리: 지금까지 배운 것 한눈에 보기"
date: 2026-09-26
tags: [aws, vpc, subnet, security-group, nacl, recap, network, infra]
categories: [aws]
---

VPC 파트에서 다룬 내용을 한 번에 모아서 정리한다. 개별 글은 아래 순서대로 이어진다.

1. [VPC와 Subnet 기본 개념](/2026/09/08/aws-vpc-subnet-basics/) — VPC/Subnet 정의, CIDR 계산, AZ와 Subnet의 관계, 예약 IP 5개
2. [Route Table, VPC Router, Internet Gateway](/2026/09/09/aws-vpc-route-table-internet-gateway/) — 서브넷 간 라우팅, 최장 일치 규칙, Public/Private Subnet의 판별 기준
3. [NAT Gateway와 Bastion Host](/2026/09/11/aws-nat-gateway-bastion-host/) — Private Subnet의 인터넷 연결과 외부 관리 접근
4. [Security Group 기본 개념과 Stateful (1)](/2026/09/16/aws-security-group/) — ENI 단위 방화벽, Allow만 가능, Stateful 동작
5. [Security Group Source (2)](/2026/09/17/aws-security-group-source/) — Prefix List, 다른 Security Group 참조
6. [NACL](/2026/09/21/aws-nacl/) — Subnet 단위 Stateless 방화벽, 규칙 평가 순서
7. [VPC 설계 예시](/2026/09/25/aws-vpc-design/) — AZ × Tier 기반 서브넷 분배 설계

## 전체 구조를 하나의 그림으로

지금까지 배운 요소들을 실제 아키텍처 하나에 모아보면 이렇다.

![VPC 파트 전체 아키텍처 요약](/assets/images/aws-vpc-recap/vpc_recap_architecture.png)

Internet Gateway를 통해 들어온 트래픽은 Public Subnet의 ALB로 향하고, ALB는 자신의 Security Group(ALB-SG)을 참조하는 EC2-SG를 통해서만 App 티어의 EC2에 접근을 허용한다. EC2는 다시 자신의 Security Group을 참조하는 RDS-SG를 통해 DB 티어에 접근한다 — IP가 아니라 Security Group 자체를 참조해서, 인스턴스가 재시작되거나 Auto Scaling으로 늘어나도 규칙을 다시 손볼 필요가 없는 구조다.

Private Subnet의 EC2가 외부로 나가야 할 때는 Public Subnet에 있는 NAT Gateway를 거쳐 Internet Gateway로 나간다. 관리자가 Private Subnet의 리소스에 직접 접속해야 할 때는 반대로 Bastion Host를 거쳐 들어간다. 이 두 리소스는 방향은 정반대지만 똑같이 Public Subnet에 있어야 한다는 공통점이 있다. 그리고 이 모든 Subnet 경계에는 NACL이 한 겹 더 걸려 있어서, Security Group으로 못 막는 특정 IP 차단 같은 걸 여기서 추가로 처리할 수 있다. 이 구조를 최소 2개 이상의 AZ에 반복해서 고가용성을 확보한다.

## 전체 용어 정리

### 기본 개념

| 용어 | 설명 |
|---|---|
| **VPC** | AWS에서 사용하는 논리적으로 격리된 가상 네트워크. Region 단위 |
| **Subnet** | VPC의 IP 대역을 더 작은 네트워크로 나눈 것. 하나의 AZ에만 존재 |
| **CIDR** | IP 주소 범위를 표현하는 방식. 사용 가능 IP = `2^(Host Bit) - 5` (AWS 예약 5개) |
| **Public / Private Subnet** | Route Table에 Internet Gateway 경로가 있는지로 구분 |

### 라우팅과 인터넷 연결

| 용어 | 설명 |
|---|---|
| **VPC Router** | VPC 생성 시 자동 생성되는 가상 라우터. 모든 Subnet 트래픽이 거쳐감 |
| **Route Table** | Destination(목적지 CIDR)과 Target(전달 대상)으로 구성된 경로표 |
| **최장 일치 규칙** | 여러 경로가 매칭되면 Prefix 숫자가 가장 큰(구체적인) 경로가 우선 |
| **Internet Gateway** | VPC와 인터넷을 연결하는 무료 리소스. IPv4/IPv6 지원, 자체 NAT 수행 |
| **NAT Gateway / Instance** | Private Subnet 리소스의 인터넷 통신을 대신 중계. Public Subnet에 위치 |
| **Bastion Host** | 외부에서 Private Subnet 리소스에 접근하기 위한 EC2. Public Subnet에 위치 |

### 보안: Security Group과 NACL

| 용어 | 설명 |
|---|---|
| **Security Group** | ENI 단위 방화벽. Allow만 가능, Stateful |
| **Prefix List** | 여러 CIDR을 묶은 목록. 고객 관리형(직접 관리) / AWS 관리형(자동 갱신) |
| **Security Group 참조** | Source를 IP 대신 다른 SG로 지정. IP 변경에 영향받지 않음 |
| **NACL** | Subnet 단위 방화벽. Allow·Deny 모두 가능, Stateless |
| **규칙 번호(NACL)** | 낮은 번호부터 평가, 매칭되면 즉시 중단 — 100단위로 여유 있게 설정 |
| **Ephemeral / Well-known Port** | 클라이언트의 임시 포트 vs 프로토콜별 고정 포트. Stateless 환경에서 특히 중요 |

### 설계

| 용어 | 설명 |
|---|---|
| **AZ × Tier 설계** | 가용 영역과 애플리케이션 티어를 축으로 서브넷 개수를 정하는 방식 |
| **예비 AZ / 예비 Tier** | 나중의 확장을 대비해 미리 마련해두는 슬롯 |

VPC 파트는 여기까지다. 다음 파트에서는 새로운 주제로 이어간다.
