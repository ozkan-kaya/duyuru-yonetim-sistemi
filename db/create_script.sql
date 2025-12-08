create table portal_user
(
    id        integer generated always as identity (maxvalue 45234234)
        primary key,
    user_name text,
    password  text,
    sicil     integer,
    is_active boolean     default true,
    is_delete boolean     default false,
    rol       varchar(20) default 'kullanici'::character varying
        constraint portal_user_rol_check
            check ((rol)::text = ANY
                   ((ARRAY ['kullanici'::character varying, 'yonetici'::character varying, 'admin'::character varying])::text[]))
);

alter table portal_user
    owner to postgres;

create index idx_portal_user_active
    on portal_user (is_active, is_delete);

create table portal_departman
(
    id            integer generated always as identity
        constraint departmanlar_pkey
            primary key,
    departman_adi text not null
);

alter table portal_departman
    owner to postgres;

create table portal_departman_users
(
    id            integer generated always as identity (maxvalue 45234234)
        primary key,
    department_id integer,
    sicil         integer,
    status        integer,
    type          integer,
    ust_amir      integer,
    proje         text,
    is_delete     boolean default false,
    is_active     boolean default true,
    gorev_yeri    text
);

comment on column portal_departman_users.status is '0->yönetici
1->müdür
4->takım lideri
5->Lider
6->Amir
2->Mühendis
7->İaderi Personel
3->Teknisyen
';

comment on column portal_departman_users.type is '0->ANA GÖREV
1->VEKALET';

alter table portal_departman_users
    owner to postgres;

create index idx_portal_departman_users_active
    on portal_departman_users (is_active, is_delete);

create index idx_portal_departman_users_department
    on portal_departman_users (department_id);

create index idx_portal_departman_users_sicil
    on portal_departman_users (sicil);

create table gk_yetki_list
(
    id      integer generated always as identity (maxvalue 45234234)
        primary key,
    rol_adi text
);

alter table gk_yetki_list
    owner to postgres;

create table gk_yetkilendirme
(
    id      integer generated always as identity (maxvalue 45234234)
        primary key,
    user_id integer
        constraint fk_user
            references portal_user
            on delete cascade,
    rol_id  integer
        constraint fk_rol
            references gk_yetki_list
            on delete cascade,
    constraint uk_user_rol
        unique (user_id, rol_id)
);

alter table gk_yetkilendirme
    owner to postgres;

create table portal_duyuru
(
    id                      integer generated always as identity
        constraint duyurular_pkey
            primary key,
    baslik                  varchar(75)                        not null,
    aciklama                text                               not null,
    created_by              integer                            not null
        constraint fk_duyuru_kullanici
            references portal_user
            on delete restrict,
    duyuru_baslangic_tarihi date                     default CURRENT_TIMESTAMP,
    is_delete               boolean                  default false,
    duyuru_bitis_tarihi     date,
    oncelik                 integer                  default 2 not null
        constraint check_oncelik
            check (oncelik = ANY (ARRAY [1, 2, 3])),
    guncellenme_tarihi      timestamp with time zone default CURRENT_TIMESTAMP
);

alter table portal_duyuru
    owner to postgres;


create table portal_duyuru_user
(
    id            integer generated always as identity
        constraint duyuruyu_okuyanlar_pkey
            primary key,
    duyuru_id     integer not null
        constraint fk_duyuru
            references portal_duyuru
            on delete cascade,
    kullanici_id  integer not null
        constraint fk_kullanici
            references portal_user
            on delete cascade,
    okunma_tarihi timestamp default CURRENT_TIMESTAMP,
    constraint uk_kullanici_duyuru
        unique (kullanici_id, duyuru_id)
);

comment on table portal_duyuru_user is 'Kullanıcıların duyuruları okundu olarak işaretleme kaydı.';

alter table portal_duyuru_user
    owner to postgres;

