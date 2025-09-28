package org.santayn.reservation.models.faculty;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(
        name = "faculty",
        indexes = {
                @Index(name = "ux_faculty_name", columnList = "name", unique = true)
        }
)
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Faculty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Название факультета (уникальное)
    @Column(name = "name", nullable = false, unique = true, length = 255)
    private String name;
}
