package org.santayn.reservation.repositories;

import org.santayn.reservation.models.schedule.ScheduleSlot;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.time.LocalDateTime;
import java.util.List;

public interface ScheduleSlotRepository extends JpaRepository<ScheduleSlot, Long> {

    /** Для красивого списка — по возрастанию начала. */
    List<ScheduleSlot> findAllByOrderByStartAtAsc();

    /** Проверка пересечения интервалов: (start < endAt) && (end > startAt). */
    @Query("""
           select (count(s) > 0) from ScheduleSlot s
           where s.startAt < :endAt and s.endAt > :startAt
           """)
    boolean existsOverlapping(LocalDateTime startAt, LocalDateTime endAt);
}
