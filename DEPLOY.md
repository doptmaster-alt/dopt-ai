# DIOPT AI 배포 가이드

## 아키텍처 개요

```
┌─────────────────────────────────────────────┐
│              AWS EC2 (Ubuntu)                │
│                                              │
│  ┌────────┐  ┌──────────┐  ┌──────────────┐ │
│  │ Nginx  │→│ Staging   │  │ Production   │ │
│  │ :80/443│  │ :3100     │  │ :3000        │ │
│  └────────┘  └──────────┘  └──────────────┘ │
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ Docker Volumes (EBS)                     ││
│  │  - data/ (SQLite DB)                     ││
│  │  - uploads/ (파일 업로드)                 ││
│  │  - learning/ (AI 학습 데이터)            ││
│  └──────────────────────────────────────────┘│
│                                              │
│  ┌──────────────────────────────────────────┐│
│  │ 자동 백업 (매일 3시)                     ││
│  │  → S3 또는 로컬 backups/daily/           ││
│  └──────────────────────────────────────────┘│
└─────────────────────────────────────────────┘
```

## 1단계: AWS EC2 서버 준비

### 인스턴스 추천
- **인스턴스 타입**: t3.medium (2 vCPU, 4GB RAM) - 시작점
  - 사용자 증가 시 t3.large로 업그레이드
- **OS**: Ubuntu 24.04 LTS
- **스토리지**: 50GB EBS (gp3)
- **보안 그룹**: 80(HTTP), 443(HTTPS), 22(SSH) 포트 오픈

### 서버 초기 설정
```bash
# Docker 설치
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Docker Compose 설치 (Docker 최신 버전에 포함됨)
docker compose version

# 프로젝트 배포
git clone [your-repo] /opt/diopt-ai
cd /opt/diopt-ai
```

## 2단계: 환경 설정

```bash
# 스테이징 환경변수
cp .env.staging.example .env.staging
nano .env.staging  # API 키들 설정

# 프로덕션 환경변수
cp .env.production.example .env.production
nano .env.production  # API 키들 설정 (반드시 다른 SECRET 사용!)
```

### 필수 설정 항목
| 변수 | 설명 | 중요도 |
|---|---|---|
| ANTHROPIC_API_KEY | Claude AI API 키 | 필수 |
| NEXTAUTH_SECRET | 세션 암호화 키 (32자 이상 랜덤) | 필수 |
| NEXTAUTH_URL | 서버 URL (https://ai.doptstudio.com) | 필수 |
| GEMINI_API_KEY | Google Gemini API 키 | 필수 |

### NEXTAUTH_SECRET 생성
```bash
openssl rand -base64 32
```

## 3단계: SSL 인증서 (HTTPS)

### Option A: Let's Encrypt (무료, 추천)
```bash
# certbot 설치
sudo apt install certbot

# 인증서 발급 (nginx 중지 후)
sudo certbot certonly --standalone -d ai.doptstudio.com

# 인증서 복사
mkdir -p nginx/ssl
sudo cp /etc/letsencrypt/live/ai.doptstudio.com/fullchain.pem nginx/ssl/
sudo cp /etc/letsencrypt/live/ai.doptstudio.com/privkey.pem nginx/ssl/

# 자동 갱신 (crontab)
0 0 1 * * certbot renew --post-hook "docker restart diopt-nginx"
```

### Option B: 도메인 없이 테스트 (자체 서명)
```bash
mkdir -p nginx/ssl
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/privkey.pem \
  -out nginx/ssl/fullchain.pem \
  -subj "/CN=localhost"
```

## 4단계: 배포

### 스테이징 배포
```bash
./scripts/deploy.sh staging
# → http://서버IP:3100 에서 확인
```

### 스테이징 테스트 완료 후 프로덕션 배포
```bash
./scripts/deploy.sh promote
# → 스테이징 정상 확인 후 프로덕션으로 승격
```

### 직접 프로덕션 배포 (긴급 시)
```bash
./scripts/deploy.sh production
```

## 5단계: 자동 백업 설정

```bash
# 매일 새벽 3시 자동 백업
crontab -e
# 추가:
0 3 * * * /opt/diopt-ai/scripts/backup.sh >> /opt/diopt-ai/backups/backup.log 2>&1
```

## 운영 명령어

```bash
# 로그 확인
docker logs -f diopt-production
docker logs -f diopt-staging

# 컨테이너 상태
docker ps

# 서버 재시작
docker compose --profile production restart

# 수동 백업
./scripts/backup.sh

# 헬스체크
curl http://localhost:3000/api/health
curl http://localhost:3100/api/health
```

## 도메인 설정

1. 도메인 구매 (예: doptstudio.com)
2. AWS Route 53 또는 DNS 서비스에서:
   - `ai.doptstudio.com` → EC2 공인 IP
   - `staging.doptstudio.com` → EC2 공인 IP (선택)
3. nginx.conf에서 server_name 수정
4. SSL 인증서 발급

## 모니터링

- **헬스체크**: `/api/health` - 30초 간격 자동 체크
- **에러 로그**: 관리자 페이지 > 에러 로그 탭
- **피드백**: 관리자 페이지 > 피드백 탭
- **Docker 로그**: `docker logs` 명령

## 향후 확장 계획

현재 아키텍처는 다음 확장을 고려하여 설계됨:

1. **메신저/프로젝트 매니저**: 별도 마이크로서비스로 추가 (WebSocket 서버)
2. **디자이너용 앱**: 동일 인프라에 별도 컨테이너로 배포
3. **DB 마이그레이션**: SQLite → PostgreSQL (사용자 증가 시)
4. **스토리지**: 로컬 → AWS S3 (파일 증가 시)
5. **로드밸런서**: ALB 추가 (트래픽 증가 시)

Docker Compose 기반이므로 새 서비스 추가가 용이하며,
각 서비스는 독립적으로 배포/업데이트 가능합니다.
