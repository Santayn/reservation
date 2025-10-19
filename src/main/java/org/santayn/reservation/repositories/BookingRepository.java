package org.santayn.reservation.repositories;

import java.time.DayOfWeek;
import java.util.Collection;
import java.util.List;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findAllByClassroomIdAndDayOfWeekAndWeekParityTypeAndSlotId(
            Long classroomId,
            DayOfWeek dayOfWeek,
            WeekParityType weekParityType,
            Long slotId
    );

    List<Booking> findAllByGroupIdIn(Collection<Long> groupIds);

    @Query("""
        select b
        from Booking b
        where b.dayOfWeek = :day
          and b.slotId    = :slotId
          and (:classroomId is null or b.classroomId = :classroomId)
          and b.weekParityType = :type
    """)
    List<Booking> search(
            @Param("day") DayOfWeek day,
            @Param("type") WeekParityType type,
            @Param("slotId") Long slotId,
            @Param("classroomId") Long classroomId
    );

    @Query("""
       select b from Booking b
       where b.teacherId = :teacherId
         and (:dayOfWeek is null or b.dayOfWeek = :dayOfWeek)
         and (:weekParityType is null or b.weekParityType = :weekParityType)
         and (:slotId is null or b.slotId = :slotId)
         and (:classroomId is null or b.classroomId = :classroomId)
    """)
    List<Booking> searchByTeacher(
            @Param("teacherId") Long teacherId,
            @Param("dayOfWeek") DayOfWeek dayOfWeek,
            @Param("weekParityType") WeekParityType weekParityType,
            @Param("slotId") Long slotId,
            @Param("classroomId") Long classroomId
    );
}
