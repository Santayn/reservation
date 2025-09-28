// org/santayn/reservation/repositories/TeacherGroupRepository.java
package org.santayn.reservation.repositories;

import org.santayn.reservation.models.user.Teacher_Group;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface TeacherGroupRepository extends JpaRepository<Teacher_Group, Long> {
    boolean existsByTeacherIdAndGroupId(Long teacherId, Integer groupId);
    List<Teacher_Group> findByTeacherId(Long teacherId);
    void deleteByTeacherIdAndGroupId(Long teacherId, Integer groupId);
}
