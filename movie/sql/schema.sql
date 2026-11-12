-- 5주차 영화 평점 서비스 스키마 (워크북 3) 테이블 생성 SQL 그대로)
-- mysql -u root -p < sql/schema.sql
CREATE DATABASE IF NOT EXISTS umc_movie
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE umc_movie;

CREATE TABLE member (
    member_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    email       VARCHAR(254) NOT NULL UNIQUE,
    password    VARCHAR(60)  NOT NULL,
    nickname    VARCHAR(50)  NOT NULL UNIQUE,
    created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE rating (
    rating_id   BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id   BIGINT   NOT NULL,
    movie_id    BIGINT   NOT NULL,
    score       TINYINT  NOT NULL,
    comment     TEXT,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES member(member_id),
    UNIQUE KEY uk_rating_member_movie (member_id, movie_id)
);

-- 8주차 즐겨찾기 실습에서 사용할 테이블입니다. 이번 주차에는 스키마만 만들어 둡니다.
CREATE TABLE favorite (
    favorite_id BIGINT AUTO_INCREMENT PRIMARY KEY,
    member_id   BIGINT   NOT NULL,
    movie_id    BIGINT   NOT NULL,
    created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (member_id) REFERENCES member(member_id),
    UNIQUE KEY uk_favorite_member_movie (member_id, movie_id)
);
