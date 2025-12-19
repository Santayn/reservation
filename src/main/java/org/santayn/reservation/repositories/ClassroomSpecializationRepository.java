package org.santayn.reservation.repositories;

import org.santayn.reservation.models.classroom.ClassroomSpecialization;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClassroomSpecializationRepository extends JpaRepository<ClassroomSpecialization, ClassroomSpecialization.Id> {
    List<ClassroomSpecialization> findByClassroom_Id(Long classroomId);
    boolean existsByClassroom_IdAndSpecialization_Id(Long classroomId, Long specializationId);
    void deleteByClassroom_IdAndSpecialization_Id(Long classroomId, Long specializationId);
}
