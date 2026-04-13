// org/santayn/reservation/repositories/BookingRepository.java
package org.santayn.reservation.repositories;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findAllByClassroomIdAndDayOfWeekAndWeekParityTypeAndSlotId(
            Long classroomId, DayOfWeek dayOfWeek, WeekParityType weekParityType, Long slotId);

    List<Booking> findAllByGroupIdIn(Collection<Long> groupIds);

    @Query("""
        select b
          from Booking b
         where b.dayOfWeek = :day
           and b.slotId    = :slotId
           and (:classroomId is null or b.classroomId = :classroomId)
           and (:date is null or b.bookingDate is null or b.bookingDate = :date)
           and b.weekParityType in :types
    """)
    List<Booking> search(@Param("day") DayOfWeek day,
                         @Param("types") Collection<WeekParityType> types,
                         @Param("slotId") Long slotId,
                         @Param("classroomId") Long classroomId,
                         @Param("date") LocalDate date);

    @Query("""
       select b from Booking b
        where b.teacherId = :teacherId
          and (:dayOfWeek is null or b.dayOfWeek = :dayOfWeek)
          and b.weekParityType in :types
          and (:slotId is null or b.slotId = :slotId)
          and (:classroomId is null or b.classroomId = :classroomId)
    """)
    List<Booking> searchByTeacher(@Param("teacherId") Long teacherId,
                                  @Param("dayOfWeek") DayOfWeek dayOfWeek,
                                  @Param("types") Collection<WeekParityType> types,
                                  @Param("slotId") Long slotId,
                                  @Param("classroomId") Long classroomId);

    @Query("""
       select b from Booking b
        where b.groupId = :groupId
          and (:dayOfWeek is null or b.dayOfWeek = :dayOfWeek)
          and b.weekParityType in :types
          and (:slotId is null or b.slotId = :slotId)
          and (:classroomId is null or b.classroomId = :classroomId)
    """)
    List<Booking> searchByGroup(@Param("groupId") Long groupId,
                                @Param("dayOfWeek") DayOfWeek dayOfWeek,
                                @Param("types") Collection<WeekParityType> types,
                                @Param("slotId") Long slotId,
                                @Param("classroomId") Long classroomId);

    // для проверки «окно свободно» у преподавателя (date обязателен)
    @Query("""
      select count(b) from Booking b
       where b.classroomId   = :classroomId
         and b.dayOfWeek     = :day
         and b.weekParityType= :parity
         and b.slotId        = :slotId
         and b.bookingDate   = :date
    """)
    long countInWindow(@Param("classroomId") Long classroomId,
                       @Param("day") DayOfWeek day,
                       @Param("parity") WeekParityType parity,
                       @Param("slotId") Long slotId,
                       @Param("date") LocalDate date);

    @Query("""
      select count(b) from Booking b
       where b.groupId        = :groupId
         and b.dayOfWeek      = :day
         and b.weekParityType = :parity
         and b.slotId         = :slotId
         and (b.bookingDate is null or b.bookingDate = :date)
    """)
    long countGroupInWindow(@Param("groupId") Long groupId,
                            @Param("day") DayOfWeek day,
                            @Param("parity") WeekParityType parity,
                            @Param("slotId") Long slotId,
                            @Param("date") LocalDate date);

    // Чистим все разовые просроченные брони: сравнение через NOW() в PostgreSQL
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query(value = """
        DELETE FROM bookings
         WHERE expires_at IS NOT NULL
           AND expires_at < NOW()
    """, nativeQuery = true)
    int deleteExpired();
}
