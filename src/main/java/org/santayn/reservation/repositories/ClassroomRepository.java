package org.santayn.reservation.repositories;

import org.santayn.reservation.models.classroom.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {
    Optional<Classroom> findByName(String name);

    // найдёт "Ауд. 102" по токену "102" или "ауд. 102"
    Optional<Classroom> findFirstByNameContainingIgnoreCase(String token);
}
