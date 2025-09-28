package org.santayn.reservation.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
@EnableMethodSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http
                // Если нужно включить CSRF — скажи, добавим CookieCsrfTokenRepository и хедер в fetch.
                .csrf(csrf -> csrf.disable())

                .authorizeHttpRequests(auth -> auth
                        // статические ассеты и страница логина — без авторизации
                        .requestMatchers(
                                "/login.html",
                                "/cabinet/css/**",
                                "/cabinet/js/**",
                                "/favicon.ico",
                                "/error"
                        ).permitAll()

                        // API и страницы кабинета — только после логина
                        .requestMatchers("/cabinet/**").authenticated()
                        .requestMatchers("/api/**").authenticated()

                        // всё остальное можно открыть/закрыть по желанию
                        .requestMatchers(HttpMethod.GET, "/").permitAll()
                        .anyRequest().permitAll()
                )

                .formLogin(form -> form
                        .loginPage("/cabinet/login.html")     // своя форма
                        .loginProcessingUrl("/login")          // action формы
                        .defaultSuccessUrl("/cabinet/index.html", true)
                        .failureUrl("/cabinet/login.html?error")
                        .permitAll()
                )

                .logout(logout -> logout
                        .logoutUrl("/logout")
                        .logoutSuccessUrl("/cabinet/login.html?logout")
                        .deleteCookies("JSESSIONID")
                        .permitAll()
                )

                // опционально: удобно для теста REST через Postman
                .httpBasic(Customizer.withDefaults());

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }
}
