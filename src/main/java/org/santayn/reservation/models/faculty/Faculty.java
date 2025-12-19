package org.santayn.reservation.models.faculty;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "faculties", uniqueConstraints = {
        @UniqueConstraint(name = "uq_faculty_name", columnNames = {"name"})
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Faculty {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "name", nullable = false, length = 255)
    private String name;
}
