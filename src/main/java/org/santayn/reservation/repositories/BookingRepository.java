package org.santayn.reservation.repositories;

import java.time.DayOfWeek;
import java.util.List;
import org.santayn.reservation.models.booking.Booking;
import org.santayn.reservation.models.schedule.WeekParityType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface BookingRepository extends JpaRepository<Booking, Long> {

    List<Booking> findAllByClassroomIdAndDayOfWeekAndWeekParityType(
            Long classroomId,
            DayOfWeek dayOfWeek,
            WeekParityType weekParityType
    );
}
