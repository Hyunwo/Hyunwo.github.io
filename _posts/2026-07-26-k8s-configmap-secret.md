---
layout: post
title: "ConfigMap과 Secret: 왜 필요하고 어떻게 다른가"
date: 2026-07-26
tags: [kubernetes, infra]
categories: [kubernetes]
---

이번 강의는 ConfigMap과 Secret이었다. 둘 다 이름은 익숙한데 왜 필요한지, Secret이 정확히 뭐가 다른지는 헷갈렸던 부분이라 정리해본다.

## 왜 필요한가: 이미지 안에 값을 박아두면 생기는 문제

어떤 서비스 A가 있고, 이 서비스는 일반 접근과 보안 접근 두 가지를 지원한다고 해보자. 개발 환경에서는 보안 접근을 꺼두고 쓰다가, 상용 환경으로 배포할 때는 보안 접근을 켜고 접근 유저·키 값도 바꿔야 한다.

문제는 이 값들이 컨테이너 이미지 안에 그대로 박혀 있으면, 개발용 이미지와 상용용 이미지를 따로 만들고 관리해야 한다는 거다. 값 몇 개 때문에 용량 큰 이미지를 두 벌 관리하는 건 부담이 크다.

![같은 이미지, 다른 환경]({{ site.baseurl }}/assets/images/k8s-configmap-secret/same_image_diff_env.png)

그래서 환경마다 달라지는 값들은 이미지 밖에서 주입할 수 있게 만드는데, 이걸 도와주는 오브젝트가 **ConfigMap**과 **Secret**이다. 일반적인 설정값은 ConfigMap으로, 보안이 필요한 값(비밀번호, 인증키 등)은 Secret으로 분리해서 만들고, 이 둘을 Pod 생성 시 연결하면 컨테이너의 환경 변수로 값이 들어간다. 이미지는 하나만 만들어두고, 환경마다 ConfigMap/Secret의 데이터만 바꿔주면 된다.

---

## 기본 사용법: 키-값 상수 넣기

ConfigMap은 key-value로 구성된다.

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cm-dev
data:
  ACCESS_MODE: "public"
  DB_HOST: "dev-db.internal"
```

Secret도 구조는 같지만, value를 **base64로 인코딩**해서 넣어야 한다는 규칙이 있다.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: sec-dev
type: Opaque
data:
  DB_USER: ZGV2dXNlcg==     # devuser
  DB_KEY: c2VjcmV0a2V5MTIz   # secretkey123
```

이 인코딩은 Pod에 주입될 때 자동으로 디코딩되기 때문에, 컨테이너 안 환경 변수에서는 원래 값 그대로 보인다. 여기서 짚고 넘어갈 부분이 있는데, **base64는 보안 조치가 아니라 그냥 데이터 형식 규칙**이다. 누구나 디코딩할 수 있는 인코딩이라, 이것만으로 값이 안전해지는 건 아니다.

이 둘을 Pod에서 가져와 쓰려면 `envFrom`으로 레퍼런스하면 된다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod
spec:
  containers:
    - name: app
      image: my-app
      envFrom:
        - configMapRef:
            name: cm-dev
        - secretRef:
            name: sec-dev
```

## Secret이 진짜로 더 안전한 이유

그럼 Secret이 ConfigMap보다 안전하다고 하는 진짜 이유는 뭘까. 여기서 강의 내용을 조금 정확히 짚을 부분이 있다.

ConfigMap과 Secret 둘 다 **똑같이 etcd(쿠버네티스가 오브젝트를 저장하는 데이터베이스)에 저장**된다. 다만 Secret을 **볼륨으로 마운트**해서 노드에서 쓸 때는, 디스크에 쓰지 않고 **tmpfs(메모리 기반 파일시스템)** 로만 올라간다는 차이가 있다. 즉 "저장 자체가 메모리에만 된다"는 게 아니라, "노드에 파일로 내려갈 때는 디스크를 거치지 않는다"는 의미로 이해하는 게 더 정확하다. (참고로 기본 상태에서는 etcd에 있는 Secret 값도 암호화되어 있지 않다. 진짜로 암호화하려면 etcd 암호화 설정을 별도로 해줘야 한다.)

Secret은 1MB까지만 담을 수 있고, 메모리 기반이라 너무 많이 만들면 시스템 자원에 영향을 줄 수 있다는 점도 참고할 부분이다.

---

## 파일을 통째로 담는 방법

문자열 상수 말고 파일 하나를 통째로 ConfigMap에 담을 수도 있다. 이때는 파일 이름이 key, 파일 안 내용이 value가 된다.

```bash
kubectl create configmap cm-file --from-file=file-text=./config.txt
```

Secret도 같은 방식으로 만들 수 있는데, 이 명령을 쓰면 파일 내용이 자동으로 base64 처리된다. 만약 파일 내용이 이미 base64였다면 두 번 인코딩되는 셈이니 주의가 필요하다.

이렇게 만든 파일을 환경 변수 하나로 넣고 싶으면 `valueFrom`으로 특정 key를 지정해서 가져올 수 있다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod-file
spec:
  containers:
    - name: app
      image: my-app
      env:
        - name: FILE_CONTENT
          valueFrom:
            configMapKeyRef:
              name: cm-file
              key: file-text
```

## 파일을 마운트하는 방법

값을 환경 변수 하나로 넣는 대신, 파일 자체를 컨테이너 안 특정 경로에 마운트할 수도 있다.

```yaml
apiVersion: v1
kind: Pod
metadata:
  name: app-pod-mount
spec:
  containers:
    - name: app
      image: my-app
      volumeMounts:
        - name: config-volume
          mountPath: /etc/config
  volumes:
    - name: config-volume
      configMap:
        name: cm-file
```

---

## 환경 변수 방식 vs 볼륨 마운트 방식, 결정적 차이

이 두 방식에는 꽤 큰 차이가 하나 숨어 있다. Pod를 만든 뒤에 ConfigMap의 내용을 바꾸면 어떻게 될까.

![환경 변수 방식과 볼륨 마운트 방식 비교]({{ site.baseurl }}/assets/images/k8s-configmap-secret/envvar_vs_volumemount.png)

| 방식 | ConfigMap 변경 시 반영 여부 |
|---|---|
| **환경 변수 (envFrom, valueFrom)** | 반영 안 됨. Pod가 재생성돼야 새 값을 받아온다 |
| **볼륨 마운트** | 반영됨. 마운트는 원본과 연결해두는 개념이라 원본이 바뀌면 마운트된 내용도 같이 바뀐다 |

환경 변수는 Pod가 뜰 때 한 번 주입되고 끝이라 그 뒤로 ConfigMap이 바뀌어도 영향이 없다. 반면 볼륨 마운트는 원본과 계속 연결되어 있는 구조라, ConfigMap이 바뀌면 마운트된 파일 내용도 그대로 갱신된다. 상황에 따라 어떤 방식을 쓸지 판단하면 될 것 같다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **ConfigMap** | 민감하지 않은 설정값을 컨테이너에 주입할 때 사용하는 오브젝트 |
| **Secret** | 민감한 설정값(비밀번호, 인증키 등)을 저장하는 오브젝트. base64로 인코딩해서 저장 |
| **base64** | Secret의 값을 저장할 때 쓰는 인코딩 규칙. 암호화가 아니라 형식 변환일 뿐 |
| **envFrom** | ConfigMap/Secret의 모든 key-value를 통째로 환경 변수로 가져올 때 쓰는 필드 |
| **valueFrom** | ConfigMap/Secret의 특정 key 하나만 골라서 환경 변수로 가져올 때 쓰는 필드 |
| **tmpfs** | 메모리를 기반으로 동작하는 파일시스템. Secret을 볼륨으로 마운트할 때 디스크 대신 여기에 올라감 |
| **etcd** | 쿠버네티스 오브젝트(ConfigMap, Secret 포함)가 실제로 저장되는 데이터베이스 |
