// src/main/java/org/santayn/reservation/repositories/ClassroomRepository.java
package org.santayn.reservation.repositories;

import org.santayn.reservation.models.classroom.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    Optional<Classroom> findByName(String name);

    boolean existsByName(String name);
}
