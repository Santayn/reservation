// org/santayn/reservation/repositories/TeacherGroupRepository.java
package org.santayn.reservation.repositories;
import org.santayn.reservation.models.teacher.Teacher_Group;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface TeacherGroupRepository extends JpaRepository<Teacher_Group, Long> {
    List<Teacher_Group> findByTeacherId(Long teacherId);
    List<Teacher_Group> findByGroupId(Integer groupId);
    boolean existsByTeacherIdAndGroupId(Long teacherId, Integer groupId);
}
