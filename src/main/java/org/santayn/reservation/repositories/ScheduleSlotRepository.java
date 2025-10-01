package org.santayn.reservation.repositories;

import org.santayn.reservation.models.schedule_slot.ScheduleSlot;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ScheduleSlotRepository extends JpaRepository<ScheduleSlot, Long> { }
