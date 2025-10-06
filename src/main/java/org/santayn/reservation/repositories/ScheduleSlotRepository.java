package org.santayn.reservation.repositories;

import org.santayn.reservation.models.schedule.ScheduleSlot;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ScheduleSlotRepository extends JpaRepository<ScheduleSlot, Long> {}
