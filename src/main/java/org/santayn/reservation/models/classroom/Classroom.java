package org.santayn.reservation.models.classroom;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "classrooms", indexes = {
        @Index(name = "ux_classrooms_name", columnList = "name", unique = true)
})
@Data @NoArgsConstructor @AllArgsConstructor @Builder
public class Classroom {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Уникальное имя аудитории (например, "А-201")
    @Column(name = "name", nullable = false, length = 100, unique = true)
    private String name;

    @Column(name = "location", length = 255)
    private String location;

    @Column(name = "capacity")
    private Integer capacity;
}
