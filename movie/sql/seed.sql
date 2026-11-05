-- 워크북 4) 더미 데이터. movie_id 는 TMDB 실제 영화 ID (550 파이트 클럽, 155 다크 나이트)
-- password 는 bcrypt 를 배우는 6주차 전까지 더미 문자열만 넣는다. 평문 비밀번호 금지.
USE umc_movie;

INSERT INTO member (email, password, nickname) VALUES
('noco@umc.com', '$2a$10$dummyEncodedPasswordValue', '수현'),
('minseo@umc.com', '$2a$10$dummyEncodedPasswordValue', '민서');

INSERT INTO rating (member_id, movie_id, score, comment) VALUES
(1, 550, 5, '최고의 영화!'),
(1, 155, 4, '다시 봐도 명작'),
(2, 550, 3, '호불호가 갈릴 것 같아요');
