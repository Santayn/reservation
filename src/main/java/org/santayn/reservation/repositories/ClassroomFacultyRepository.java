package org.santayn.reservation.repositories;

import org.santayn.reservation.models.classroom.ClassroomFaculty;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClassroomFacultyRepository extends JpaRepository<ClassroomFaculty, ClassroomFaculty.Id> {
    List<ClassroomFaculty> findByClassroom_Id(Long classroomId);
    boolean existsByClassroom_IdAndFaculty_Id(Long classroomId, Long facultyId);
    void deleteByClassroom_IdAndFaculty_Id(Long classroomId, Long facultyId);
}
