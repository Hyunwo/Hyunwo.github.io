---
layout: post
title: "DaemonSet, Job, CronJob: 언제 왜 쓰는가"
date: 2026-08-02
tags: [kubernetes, infra]
categories: [kubernetes]
---

지금까지 ReplicaSet, Deployment처럼 "계속 떠 있어야 하는 서비스"를 관리하는 Controller를 봤다면, 이번엔 성격이 다른 세 가지 — DaemonSet, Job, CronJob을 정리한다.

## Pod를 누가 만들었는지에 따라 동작이 달라진다

같은 Pod라도 누가 만들었느냐에 따라 장애 상황에서의 동작이 다르다.

- **직접 만든 Pod**: 이 Pod가 떠 있던 Node가 다운되면, 그걸로 끝이다. 서비스가 복구되지 않는다
- **ReplicaSet이 만든 Pod**: Node 장애를 감지하면 다른 Node에 Pod를 재생성해서 서비스가 계속 유지된다. Pod 안의 프로세스가 죽어도 재시작시켜준다. 그래서 "무슨 일이 있어도 계속 떠 있어야 하는" 서비스에 쓴다
- **Job이 만든 Pod**: 프로세스가 할 일을 마치면 Pod는 "종료"되지만, 삭제되는 건 아니다. 자원을 안 쓰는 상태로 멈춰 있을 뿐이라, 로그를 나중에 들여다볼 수 있다. 필요 없어지면 직접 지우면 된다

여기서 짚을 부분이 하나 있는데, **Recreate와 Restart는 다르다.** Recreate는 Pod 자체를 다시 만드는 거라 Pod 이름과 IP가 바뀐다. Restart는 Pod는 그대로 두고 그 안의 컨테이너만 다시 기동시키는 거라 이름/IP가 유지된다.

---

## DaemonSet: 모든 Node에 하나씩

ReplicaSet은 Pod를 어느 Node에 배치할지 스케줄러에 맡기기 때문에, 자원이 많이 남은 Node에는 여러 개가 몰리고 자원이 없는 Node에는 아예 안 갈 수도 있다. **DaemonSet은 이것과 반대로, Node의 자원 상태와 무관하게 모든 Node에 Pod를 정확히 하나씩 배치한다.** Node가 10개면 Pod도 10개가 만들어진다.

![ReplicaSet vs DaemonSet 배치 방식]({{ site.baseurl }}/assets/images/k8s-daemonset-job-cronjob/replicaset_vs_daemonset.png)

이런 특성 때문에 각 Node마다 반드시 설치되어야 하는 서비스에 주로 쓴다.

- **성능 수집**: Prometheus 같은 에이전트를 모든 Node에 깔아서 모니터링 시스템에 정보를 전달
- **로그 수집**: FluentD 같은 서비스로 각 Node의 로그를 수집
- **분산 스토리지**: GlusterFS 같은 걸로 각 Node의 자원을 묶어 네트워크 파일 시스템 구성

참고로 쿠버네티스 자체도 네트워킹 처리를 위해 각 Node에 proxy 역할을 하는 Pod를 DaemonSet으로 띄운다 (kube-proxy).

```yaml
apiVersion: apps/v1
kind: DaemonSet
metadata:
  name: log-agent
spec:
  selector:
    matchLabels:
      app: log-agent
  template:
    metadata:
      labels:
        app: log-agent
    spec:
      nodeSelector:
        kubernetes.io/os: linux
      containers:
        - name: log-agent
          image: fluentd:latest
          ports:
            - containerPort: 8080
              hostPort: 18080
```

- **nodeSelector**: DaemonSet은 "한 Node에 여러 개"는 못 만들지만, 특정 라벨이 없는 Node는 배치 대상에서 뺄 수는 있다. 예를 들어 Node들의 OS가 섞여 있을 때 특정 OS에서만 동작해야 하는 Pod라면 nodeSelector로 그 Node만 골라서 배치할 수 있다
- **hostPort**: Node의 특정 포트를 Pod로 직접 연결하는 방식이다. NodePort 타입 Service로 "특정 Node로 들어온 트래픽을 그 Node의 Pod로 연결"하는 것과 비슷한 결과를 hostPort로도 만들 수 있다

---

## Job: 끝나야 하는 작업

Job도 template과 selector가 있지만, selector는 직접 안 넣어도 Job이 알아서 만들어준다. template에는 "특정 작업만 하고 끝나는" Pod의 내용이 들어간다.

```yaml
apiVersion: batch/v1
kind: Job
metadata:
  name: data-migration
spec:
  completions: 6
  parallelism: 2
  activeDeadlineSeconds: 30
  backoffLimit: 3
  template:
    spec:
      restartPolicy: Never
      containers:
        - name: migrate
          image: my-migration-tool:latest
```

- **completions**: 총 몇 개의 Pod가 작업을 완료해야 Job이 끝나는지. `6`이면 Pod 6개가 순차적으로 실행되어 모두 끝나야 Job도 종료된다
- **parallelism**: 동시에 몇 개까지 Pod를 띄울지. `2`면 2개씩 병렬로 실행된다
- **activeDeadlineSeconds**: Job의 최대 허용 시간. `30`이면 30초가 지나는 순간 진행 중이던 Pod는 전부 삭제되고, 아직 실행 안 된 Pod도 더 이상 실행되지 않는다. 원래 예상 시간보다 훨씬 오래 걸리면 "행이 걸렸다"고 보고 자원을 회수하는 안전장치다
- **restartPolicy**: Job의 Pod는 `Never`와 `OnFailure` 중 하나만 쓸 수 있다. (Deployment/ReplicaSet처럼 계속 떠 있어야 하는 Pod가 쓰는 `Always`는 Job에서는 아예 선택할 수 없다)

> 참고로 Kubernetes 1.31부터는 `podFailurePolicy`라는 옵션이 정식 기능(stable)으로 추가됐다. 이걸 쓰면 Pod가 실패했을 때 종료 코드나 상태에 따라 "이건 재시도할 가치가 있다 / 이건 바로 실패 처리하자"를 세밀하게 나눠서 처리할 수 있다. `backoffLimit` 하나로는 모든 실패를 똑같이 취급하는데, 예를 들어 노드 문제로 강제 종료된 경우는 재시도 횟수에서 제외하는 식의 처리가 가능해진다. Indexed Job에서 인덱스별로 재시도 횟수를 따로 관리하는 `backoffLimitPerIndex`는 Kubernetes 1.33부터 정식 기능이 됐다. 현재 최신 버전인 1.36에서도 둘 다 그대로 쓸 수 있다.

---

## CronJob: Job을 주기적으로

CronJob은 Job 템플릿을 가지고 있다가, 지정한 schedule 주기마다 Job을 만들어준다. schedule은 일반적인 Cron 포맷을 그대로 쓴다.

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: db-backup
spec:
  schedule: "0 3 * * *"
  timeZone: "Asia/Seoul"
  concurrencyPolicy: Forbid
  jobTemplate:
    spec:
      template:
        spec:
          restartPolicy: OnFailure
          containers:
            - name: backup
              image: my-backup-tool:latest
```

대표적인 사용처는 새벽마다 도는 DB 백업, 주기적인 업데이트 확인, 예약 메일/SMS 발송 같은 것들이다.

### concurrencyPolicy: 겹치는 스케줄을 어떻게 처리할까

이전 스케줄의 Job이 아직 안 끝났는데 다음 스케줄 시간이 되면 어떻게 될지 정하는 옵션이다. 기본값은 `Allow`다.

![concurrencyPolicy 3가지 비교]({{ site.baseurl }}/assets/images/k8s-daemonset-job-cronjob/cronjob_concurrency_policy.png)

- **Allow** (기본값): 이전 Job이 실행 중이든 끝났든 상관없이, 스케줄 시간이 되면 무조건 새 Job을 만든다. 여러 Job이 동시에 돌아갈 수 있다
- **Forbid**: 이전 Job이 아직 실행 중이면 이번 스케줄은 건너뛴다. 이전 Job이 끝나는 즉시 다음 스케줄의 Job이 실행된다
- **Replace**: 이전 Job을 취소하고 새 스케줄의 Job으로 교체한다. 참고로 이 동작은 예전 버전과 달라졌는데, **기존 Job이 살아남아서 새 Pod에 연결되는 게 아니라, 기존 Job과 Pod를 삭제하고 완전히 새로운 Job과 Pod를 만드는 방식**으로 바뀌었다

### timeZone: Kubernetes 1.27부터 정식 추가된 필드

강의에는 없던 내용이다. Kubernetes 1.27부터 CronJob에 `spec.timeZone` 필드가 정식 기능(stable)으로 추가됐다. 이게 없던 시절에는 schedule이 클러스터 컨트롤 플레인의 시간대(보통 UTC) 기준으로만 동작해서, 한국 시간 기준으로 스케줄을 맞추려면 시차를 직접 계산해서 cron 표현식에 반영해야 했다. 지금(1.27 이상, 현재 최신 버전 1.36 포함)은 위 예시처럼 `timeZone: "Asia/Seoul"`을 넣어주면 그 시간대 기준으로 바로 스케줄이 돈다.

---

## 용어 정리

| 용어 | 설명 |
|---|---|
| **DaemonSet** | Node의 자원 상태와 무관하게 모든 Node에 Pod를 하나씩 배치하는 Controller |
| **hostPort** | Node의 특정 포트를 Pod에 직접 연결하는 설정 |
| **Job** | 특정 작업을 완료하면 종료되는 Pod를 관리하는 Controller |
| **completions** | Job이 완료로 판정되기 위해 필요한 총 성공 Pod 개수 |
| **parallelism** | Job에서 동시에 실행할 수 있는 Pod 개수 |
| **activeDeadlineSeconds** | Job의 최대 허용 실행 시간. 초과 시 모든 Pod가 삭제되고 Job이 중단됨 |
| **backoffLimit** | Job의 Pod가 실패했을 때 재시도할 수 있는 최대 횟수 |
| **podFailurePolicy** | 종료 코드/Pod 상태에 따라 재시도 여부를 세밀하게 제어하는 옵션 (Kubernetes 1.31+, stable) |
| **backoffLimitPerIndex** | Indexed Job에서 인덱스별로 재시도 횟수를 따로 관리하는 옵션 (Kubernetes 1.33+, stable) |
| **CronJob** | Job을 지정한 주기(schedule)마다 자동으로 생성해주는 Controller |
| **concurrencyPolicy** | 이전 스케줄의 Job이 끝나지 않은 상태에서 다음 스케줄이 도래했을 때의 처리 방식 (Allow/Forbid/Replace) |
| **timeZone** | CronJob의 schedule을 해석할 기준 시간대를 지정하는 필드 (Kubernetes 1.27+, stable) |
