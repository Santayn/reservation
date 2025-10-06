package org.santayn.reservation.config;

import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.Objects;

/**
 * Первичная инициализация таблицы schedule_slots фиксированными слотами.
 * Вставляет записи с конкретными ID (1..6), чтобы фронтенд мог ссылаться на них.
 * Столбцы start_at/end_at имеют тип TIMESTAMP, поэтому пишем LocalDateTime с якорной датой.
 */
@Component
public class ScheduleSlotSeeder implements ApplicationRunner {

    private final JdbcTemplate jdbc;
    private static final LocalDate ANCHOR_DATE = LocalDate.of(1970, 1, 1);

    public ScheduleSlotSeeder(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureSlot(1L, LocalTime.of(8, 0),  LocalTime.of(9, 30));
        ensureSlot(2L, LocalTime.of(9, 40), LocalTime.of(11, 10));
        ensureSlot(3L, LocalTime.of(11, 20), LocalTime.of(12, 50));
        ensureSlot(4L, LocalTime.of(13, 30), LocalTime.of(15, 0));
        ensureSlot(5L, LocalTime.of(15, 10), LocalTime.of(16, 40));
        ensureSlot(6L, LocalTime.of(16, 50), LocalTime.of(18, 20));
    }

    private void ensureSlot(Long id, LocalTime start, LocalTime end) {
        Integer cnt = jdbc.queryForObject(
                "select count(*) from schedule_slots where id = ?",
                Integer.class,
                id
        );
        LocalDateTime startDt = LocalDateTime.of(ANCHOR_DATE, start);
        LocalDateTime endDt   = LocalDateTime.of(ANCHOR_DATE, end);

        if (Objects.requireNonNullElse(cnt, 0) == 0) {
            // identity/serial: позволяем задать фиксированный id
            jdbc.update(
                    "insert into schedule_slots (id, start_at, end_at) overriding system value values (?,?,?)",
                    id, Timestamp.valueOf(startDt), Timestamp.valueOf(endDt)
            );
        } else {
            jdbc.update(
                    "update schedule_slots set start_at = ?, end_at = ? where id = ?",
                    Timestamp.valueOf(startDt), Timestamp.valueOf(endDt), id
            );
        }
    }
}
