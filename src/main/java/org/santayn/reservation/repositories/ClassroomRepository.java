package org.santayn.reservation.repositories;

import org.santayn.reservation.models.classroom.Classroom;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

/**
 * Репозиторий для аудиторий.
 *
 * Обрати внимание:
 *  - Тут нет привязки к layoutId, мы оставляем твою исходную модель поиска.
 */
public interface ClassroomRepository extends JpaRepository<Classroom, Long> {

    /**
     * Точное совпадение имени: "Ауд. 102".
     */
    Optional<Classroom> findByName(String name);

    /**
     * Находит первую аудиторию, имя которой содержит токен (без учёта регистра).
     * Например, "102" найдёт "Ауд. 102".
     */
    Optional<Classroom> findFirstByNameContainingIgnoreCase(String token);
}
