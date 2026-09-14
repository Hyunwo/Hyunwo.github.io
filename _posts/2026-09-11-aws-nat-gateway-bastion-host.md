---
layout: post
title: "AWS NAT Gateway와 Bastion Host"
date: 2026-09-11
tags: [aws, vpc, nat-gateway, bastion-host, network, infra]
categories: [aws]
---

[지난 글](/2026/09/09/aws-vpc-route-table-internet-gateway/)에서 Public Subnet이 Internet Gateway를 통해 인터넷과 통신하는 구조를 정리했다. 이번 글에서는 Private Subnet 쪽 문제를 다룬다. Private Subnet에는 인터넷으로 가는 경로 자체가 없는데, 그 안의 리소스가 외부와 통신해야 할 때는 어떻게 해야 할까 — NAT Gateway와 Bastion Host로 답한다.

## Private Subnet의 문제: 인터넷과 연결할 방법이 없다

Private Subnet에 있는 EC2 인스턴스에 DB 엔진이나 애플리케이션을 설치하고 싶다고 해보자. 설치 파일을 받으려면 외부 인터넷과 통신해야 하는데, Private Subnet은 애초에 인터넷으로 가는 경로가 없다. 설치 후에 업데이트를 받아야 할 때도 마찬가지 문제가 생긴다. 반대 방향도 있다. 관리자가 외부에서 이 Private Subnet 안의 인스턴스에 직접 접속해야 하는 경우도 있는데, 이 역시 경로가 없어서 불가능하다.

이 두 가지 방향의 문제를 각각 해결해주는 게 **NAT Gateway**와 **Bastion Host**다. NAT Gateway는 내부에서 외부로 나가는 트래픽을, Bastion Host는 외부에서 내부로 들어오는 트래픽을 중계한다.

---

## NAT Gateway: Private Subnet의 트래픽을 대신 전달하는 창구

NAT Gateway는 Private Subnet에 있는 리소스가 외부 인터넷과 통신할 수 있도록 중계해주는 리소스다. NAT(Network Address Translation)라는 이름대로, 어떤 네트워크 주소를 다른 주소로 바꿔서 트래픽을 대신 전달해주는 역할을 한다.

NAT 역할을 하는 리소스에는 NAT Gateway와 NAT Instance 두 가지가 있다. NAT Instance는 단일 EC2 인스턴스이고, NAT Gateway는 AWS가 제공하는 관리형 서비스다.

| 구분 | NAT Instance | NAT Gateway |
|---|---|---|
| 형태 | 단일 EC2 인스턴스 | AWS 관리형 서비스 |
| 고가용성 | 직접 확보해야 함 (여러 대 구성, Auto Scaling 등) | 기본적으로 확보되어 있음 |
| 비용 | 상대적으로 저렴 | 상대적으로 비쌈 |
| 적합한 용도 | 테스트, 간단한 구성 | 프로덕션, 대규모 서비스 |

NAT Instance는 그냥 EC2 인스턴스이기 때문에 언제든 떨어질 수 있고, 고가용성을 확보하려면 직접 여러 대를 구성해야 한다. 반면 NAT Gateway는 기본적으로 고가용성이 확보된 관리형 서비스라 별도 조치가 필요 없다. 그래서 비용에 민감한 테스트 환경이 아니라면 NAT Gateway를 쓰는 게 일반적이다.

### 배치 규칙: 반드시 Public Subnet에 있어야 한다

NAT Gateway와 NAT Instance는 둘 다 Subnet 단위 리소스이고, **반드시 Public Subnet에 위치해야 한다.** 외부 인터넷과 직접 통신할 수 있어야 Private Subnet의 트래픽을 대신 전달할 수 있기 때문이다. 그리고 Subnet은 하나의 AZ에만 속하므로, 고가용성을 제대로 확보하려면 AZ마다 하나씩 두는 게 일반적이다.

### 트래픽 흐름

Private Subnet의 EC2가 외부와 통신하고 싶을 때는 이렇게 흐른다.

```text
Private EC2 → Route Table → NAT Gateway (Public Subnet) → Internet Gateway → Internet
```

EC2가 트래픽을 발생시키면 Route Table을 거쳐 같은 AZ의 NAT Gateway로 가고, NAT Gateway가 이를 대신 받아 Internet Gateway를 통해 외부와 통신한 뒤 결과를 다시 EC2로 중계해준다. 비유하자면 정당이나 대통령의 대변인과 비슷하다. 중요한 인물(Private EC2)은 안쪽에 숨어 있고, 외부와의 소통은 대변인(NAT Gateway)이 대신 처리해서 결과만 전달해주는 구조다.

### 비용

NAT Gateway는 대부분의 VPC 리소스와 달리 비용이 발생한다. 프로비저닝만 해도 시간당 요금이 붙고, 여기에 처리하는 트래픽 GB당 요금이 추가로 부과된다. 정확한 금액은 리전과 시점에 따라 달라지므로 [AWS 공식 요금표](https://aws.amazon.com/vpc/pricing/)에서 최신 수치를 확인하는 게 정확한데, 대략 시간당 몇 센트 수준이라 트래픽이 없어도 하루 1~2달러 정도는 기본으로 나간다고 생각하면 된다. NAT Instance는 EC2 인스턴스이므로 당연히 인스턴스 요금이 별도로 발생한다.

> 참고로 2025년 11월에 **Regional NAT Gateway**라는 새로운 옵션이 나왔다. 기존 방식(Zonal NAT Gateway, 지금까지 설명한 내용)은 AZ마다 Public Subnet에 하나씩 만들어야 했는데, Regional NAT Gateway는 Internet Gateway처럼 VPC에 바로 연결하는 방식이라 별도의 Public Subnet 구성 없이도 만들 수 있고, 워크로드에 따라 AZ 간 자동으로 확장·축소된다. 다만 아직 신규 옵션이고 기존 자격증 커리큘럼은 Zonal 방식을 기준으로 하므로, 우선 Zonal NAT Gateway를 기본으로 알아두고 참고 정도로만 기억해두면 된다.

---

## Bastion Host: 외부에서 Private Subnet에 접속하는 통로

Bastion Host는 NAT Gateway와 정반대 방향의 문제를 해결한다. 외부의 관리자가 Private Subnet 안의 리소스에 접속해야 할 때 경로를 만들어주는 서버다. 별도의 AWS 서비스가 아니라 EC2 인스턴스 자체이고, 외부와 통신해야 하므로 이 역시 Public Subnet에 있어야 한다.

동작 방식은 NAT Gateway와 대칭적이다. 외부에서 온 트래픽을 Bastion Host가 받아서, 이 Bastion Host가 다시 Private Subnet 안의 리소스로 접근해주는 중개인 역할을 한다. 호주권에서는 Bastion Host를 **Jump Host**라고도 부르는데, 배터리가 방전됐을 때 점프 케이블로 시동을 걸어주는 것과 비슷한 이미지다.

Bastion Host도 고가용성을 고려한다면 2개 이상을 두거나, 서로 다른 AZ에 배치하는 걸 고려해야 한다. Bastion Host 외에도 Private Subnet에 접근하는 다른 방법들이 있는데, 그건 이후 글에서 다룬다.

---

## NAT Gateway vs Bastion Host

두 리소스 모두 Public Subnet에 위치한다는 공통점이 있지만, 트래픽 방향과 목적이 정반대다.

| 구분 | NAT Gateway | Bastion Host |
|---|---|---|
| 트래픽 방향 | 내부(Private) → 외부(Internet) | 외부(Internet) → 내부(Private) |
| 목적 | Private Subnet 리소스의 인터넷 접근 지원 | 관리자의 Private Subnet 접근 지원 |
| 위치 | Public Subnet | Public Subnet |
| 형태 | 관리형 서비스(Gateway) 또는 EC2(Instance) | EC2 인스턴스 |

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **NAT** | Network Address Translation. 네트워크 주소를 바꿔서 트래픽을 중계하는 것 |
| **NAT Gateway** | Private Subnet 리소스의 인터넷 통신을 지원하는 AWS 관리형 서비스. Public Subnet에 위치 |
| **NAT Instance** | NAT Gateway와 같은 역할을 하는 단일 EC2 인스턴스. 저비용·테스트용에 적합 |
| **Regional NAT Gateway** | Public Subnet 없이 VPC에 바로 연결하는 신규 NAT Gateway 옵션 (2025년 11월 출시) |
| **Bastion Host** | 외부에서 Private Subnet 리소스에 접근하기 위한 EC2 인스턴스. Public Subnet에 위치 |
| **Jump Host** | Bastion Host의 다른 이름 (호주권에서 주로 사용) |

다음 글에서는 아직 다루지 않은 Security Group과 NACL, 인스턴스·서브넷 수준의 보안 규칙을 정리한다.
