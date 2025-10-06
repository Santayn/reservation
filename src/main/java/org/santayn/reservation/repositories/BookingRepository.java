package org.santayn.reservation.repositories;

import org.santayn.reservation.models.booking.Booking;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface BookingRepository extends JpaRepository<Booking, Long> {

    Optional<Booking> findByDateAndSlot_IdAndClassroom_Id(LocalDate date, Long slotId, Long classroomId);

    void deleteByDateAndSlot_IdAndClassroom_Id(LocalDate date, Long slotId, Long classroomId);

    long deleteByDateBefore(LocalDate date);

    @EntityGraph(attributePaths = {"classroom", "groups", "createdBy"})
    List<Booking> findAllByDateAndSlot_Id(LocalDate date, Long slotId);
}
