export const templateNegocio = {
  id: 'negocio',
  label: 'Negocio General',
  category: 'negocios',
  color: '#374151',
  description: 'Pagina profesional para cualquier tipo de negocio.',
  pages: [
    {
      id: 'home',
      label: 'Inicio',
      routePath: '/',
      required: true,
      page: {
        schemaVersion: 1,
        id: 'page_neg_home',
        slug: '/',
        title: 'Inicio',
        visibility: 'public',
        regions: {
          main: { id: 'region_neg_main', children: ['blk_neg_nav', 'blk_neg_hero', 'blk_neg_about', 'blk_neg_services_preview', 'blk_neg_cta', 'blk_neg_footer'] }
        },
        blocks: {
          blk_neg_nav: {
            id: 'blk_neg_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Negocio',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Servicios', href: '/servicios' },
                { label: 'Acerca de', href: '/acerca-de' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_neg_hero: {
            id: 'blk_neg_hero',
            type: 'HeroBlock',
            props: {
              variant: 'split',
              title: 'Soluciones profesionales para tu negocio',
              subtitle: 'Impulsamos el crecimiento de empresas con servicios de calidad',
              ctaLabel: 'Conoce nuestros servicios',
              ctaHref: '/servicios'
            },
            children: {}
          },
          blk_neg_about: {
            id: 'blk_neg_about',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_about',
                children: ['blk_neg_about_heading', 'blk_neg_about_cols']
              }
            }
          },
          blk_neg_about_heading: {
            id: 'blk_neg_about_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Quienes somos' },
            children: {}
          },
          blk_neg_about_cols: {
            id: 'blk_neg_about_cols',
            type: 'ColumnsBlock',
            props: { columns: 2, gap: 'lg' },
            children: {
              default: {
                id: 'region_neg_about_cols',
                children: ['blk_neg_about_col1', 'blk_neg_about_col2']
              }
            }
          },
          blk_neg_about_col1: {
            id: 'blk_neg_about_col1',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_neg_about_col1',
                children: ['blk_neg_about_col1_text']
              }
            }
          },
          blk_neg_about_col1_text: {
            id: 'blk_neg_about_col1_text',
            type: 'TextBlock',
            props: { text: 'Somos una empresa especializada en proporcionar soluciones integradas para empresas de todos los tamanios. Con mas de 15 anos de experiencia, hemos ayudado a cientos de negocios a alcanzar sus objetivos.' },
            children: {}
          },
          blk_neg_about_col2: {
            id: 'blk_neg_about_col2',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_neg_about_col2',
                children: ['blk_neg_about_col2_text']
              }
            }
          },
          blk_neg_about_col2_text: {
            id: 'blk_neg_about_col2_text',
            type: 'TextBlock',
            props: { text: 'Nuestro equipo de profesionales dedicados se compromete a entregar resultados excepcionales. Utilizamos tecnologia de punta y las mejores practicas de la industria para garantizar el exito de tu negocio.' },
            children: {}
          },
          blk_neg_services_preview: {
            id: 'blk_neg_services_preview',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_neg_services_preview',
                children: ['blk_neg_services_heading', 'blk_neg_services_grid']
              }
            }
          },
          blk_neg_services_heading: {
            id: 'blk_neg_services_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestros servicios' },
            children: {}
          },
          blk_neg_services_grid: {
            id: 'blk_neg_services_grid',
            type: 'GridBlock',
            props: { columns: 3, gap: 'md' },
            children: {
              default: {
                id: 'region_neg_services_grid',
                children: ['blk_neg_service_card_1', 'blk_neg_service_card_2', 'blk_neg_service_card_3']
              }
            }
          },
          blk_neg_service_card_1: {
            id: 'blk_neg_service_card_1',
            type: 'CardBlock',
            props: { title: 'Consultoría empresarial', description: 'Asesoramiento estrategico para optimizar operaciones y maximizar rentabilidad' },
            children: {}
          },
          blk_neg_service_card_2: {
            id: 'blk_neg_service_card_2',
            type: 'CardBlock',
            props: { title: 'Desarrollo tecnologico', description: 'Soluciones digitales personalizadas adaptadas a tus necesidades especificas' },
            children: {}
          },
          blk_neg_service_card_3: {
            id: 'blk_neg_service_card_3',
            type: 'CardBlock',
            props: { title: 'Soporte profesional', description: 'Equipo disponible 24/7 para resolver tus problemas y asegurar continuidad operativa' },
            children: {}
          },
          blk_neg_cta: {
            id: 'blk_neg_cta',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_cta',
                children: ['blk_neg_cta_heading', 'blk_neg_cta_text', 'blk_neg_cta_button']
              }
            }
          },
          blk_neg_cta_heading: {
            id: 'blk_neg_cta_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Listo para impulsar tu negocio' },
            children: {}
          },
          blk_neg_cta_text: {
            id: 'blk_neg_cta_text',
            type: 'TextBlock',
            props: { text: 'Contactanos hoy para una consulta gratuita y descubre como podemos ayudarte.' },
            children: {}
          },
          blk_neg_cta_button: {
            id: 'blk_neg_cta_button',
            type: 'ButtonBlock',
            props: { label: 'Solicitar consulta', href: '/contacto', variant: 'primary' },
            children: {}
          },
          blk_neg_footer: {
            id: 'blk_neg_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Negocio',
              tagline: 'Soluciones profesionales para tu exito',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Servicios', href: '/servicios' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          }
        },
        seo: {
          title: 'Mi Negocio - Soluciones profesionales',
          description: 'Servicios empresariales de calidad para impulsar tu negocio al siguiente nivel',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'servicios',
      label: 'Servicios',
      routePath: '/servicios',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_neg_servicios',
        slug: '/servicios',
        title: 'Servicios',
        visibility: 'public',
        regions: {
          main: { id: 'region_neg_servicios_main', children: ['blk_neg_serv_nav', 'blk_neg_serv_hero', 'blk_neg_serv_list', 'blk_neg_serv_testimonials', 'blk_neg_serv_footer'] }
        },
        blocks: {
          blk_neg_serv_nav: {
            id: 'blk_neg_serv_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Negocio',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Servicios', href: '/servicios' },
                { label: 'Acerca de', href: '/acerca-de' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_neg_serv_hero: {
            id: 'blk_neg_serv_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_serv_hero',
                children: ['blk_neg_serv_hero_heading', 'blk_neg_serv_hero_text']
              }
            }
          },
          blk_neg_serv_hero_heading: {
            id: 'blk_neg_serv_hero_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Nuestros servicios' },
            children: {}
          },
          blk_neg_serv_hero_text: {
            id: 'blk_neg_serv_hero_text',
            type: 'TextBlock',
            props: { text: 'Descubre la completa gama de servicios que ofrecemos para impulsar tu negocio' },
            children: {}
          },
          blk_neg_serv_list: {
            id: 'blk_neg_serv_list',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_neg_serv_list',
                children: ['blk_neg_serv_list_heading', 'blk_neg_serv_cards_grid']
              }
            }
          },
          blk_neg_serv_list_heading: {
            id: 'blk_neg_serv_list_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Servicios disponibles' },
            children: {}
          },
          blk_neg_serv_cards_grid: {
            id: 'blk_neg_serv_cards_grid',
            type: 'GridBlock',
            props: { columns: 2, gap: 'lg' },
            children: {
              default: {
                id: 'region_neg_serv_cards_grid',
                children: ['blk_neg_serv_detail_1', 'blk_neg_serv_detail_2', 'blk_neg_serv_detail_3', 'blk_neg_serv_detail_4']
              }
            }
          },
          blk_neg_serv_detail_1: {
            id: 'blk_neg_serv_detail_1',
            type: 'CardBlock',
            props: {
              title: 'Consultoría empresarial',
              description: 'Analisis profundo de tu organizacion para identificar oportunidades de mejora y crecimiento sostenible'
            },
            children: {}
          },
          blk_neg_serv_detail_2: {
            id: 'blk_neg_serv_detail_2',
            type: 'CardBlock',
            props: {
              title: 'Transformacion digital',
              description: 'Implementacion de tecnologias modernas para automatizar procesos y mejorar eficiencia operativa'
            },
            children: {}
          },
          blk_neg_serv_detail_3: {
            id: 'blk_neg_serv_detail_3',
            type: 'CardBlock',
            props: {
              title: 'Capacitacion de equipos',
              description: 'Programas de entrenamiento profesional para fortalecer habilidades y competencias de tu personal'
            },
            children: {}
          },
          blk_neg_serv_detail_4: {
            id: 'blk_neg_serv_detail_4',
            type: 'CardBlock',
            props: {
              title: 'Soporte integral',
              description: 'Asistencia continua durante la implementacion de soluciones y despues para asegurar exito'
            },
            children: {}
          },
          blk_neg_serv_testimonials: {
            id: 'blk_neg_serv_testimonials',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_serv_testimonials',
                children: ['blk_neg_serv_test_heading', 'blk_neg_serv_test_grid']
              }
            }
          },
          blk_neg_serv_test_heading: {
            id: 'blk_neg_serv_test_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Lo que dicen nuestros clientes' },
            children: {}
          },
          blk_neg_serv_test_grid: {
            id: 'blk_neg_serv_test_grid',
            type: 'GridBlock',
            props: { columns: 3, gap: 'md' },
            children: {
              default: {
                id: 'region_neg_serv_test_grid',
                children: ['blk_neg_serv_test_1', 'blk_neg_serv_test_2', 'blk_neg_serv_test_3']
              }
            }
          },
          blk_neg_serv_test_1: {
            id: 'blk_neg_serv_test_1',
            type: 'TestimonialBlock',
            props: {
              quote: 'Gracias a sus servicios hemos logrado aumentar nuestra productividad en un 40 por ciento',
              author: 'Juan Garcia',
              role: 'CEO de TechStartup'
            },
            children: {}
          },
          blk_neg_serv_test_2: {
            id: 'blk_neg_serv_test_2',
            type: 'TestimonialBlock',
            props: {
              quote: 'El equipo profesional y dedicado hizo la diferencia en nuestro crecimiento empresarial',
              author: 'Maria Lopez',
              role: 'Directora de Operaciones'
            },
            children: {}
          },
          blk_neg_serv_test_3: {
            id: 'blk_neg_serv_test_3',
            type: 'TestimonialBlock',
            props: {
              quote: 'Excelente soporte y resultados excepcionales. Los recomendamos ampliamente',
              author: 'Carlos Martinez',
              role: 'Gerente General'
            },
            children: {}
          },
          blk_neg_serv_footer: {
            id: 'blk_neg_serv_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Negocio',
              tagline: 'Soluciones profesionales para tu exito'
            },
            children: {}
          }
        },
        seo: {
          title: 'Servicios - Mi Negocio',
          description: 'Conoce nuestros servicios profesionales adaptados a tu negocio',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'acerca-de',
      label: 'Acerca de',
      routePath: '/acerca-de',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_neg_acerca_de',
        slug: '/acerca-de',
        title: 'Acerca de',
        visibility: 'public',
        regions: {
          main: { id: 'region_neg_acerca_main', children: ['blk_neg_ac_nav', 'blk_neg_ac_hero', 'blk_neg_ac_content', 'blk_neg_ac_team', 'blk_neg_ac_footer'] }
        },
        blocks: {
          blk_neg_ac_nav: {
            id: 'blk_neg_ac_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Negocio',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Servicios', href: '/servicios' },
                { label: 'Acerca de', href: '/acerca-de' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_neg_ac_hero: {
            id: 'blk_neg_ac_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_ac_hero',
                children: ['blk_neg_ac_hero_heading']
              }
            }
          },
          blk_neg_ac_hero_heading: {
            id: 'blk_neg_ac_hero_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Acerca de nosotros' },
            children: {}
          },
          blk_neg_ac_content: {
            id: 'blk_neg_ac_content',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_neg_ac_content',
                children: ['blk_neg_ac_content_heading', 'blk_neg_ac_content_text', 'blk_neg_ac_content_spacer', 'blk_neg_ac_values_heading', 'blk_neg_ac_values_cols']
              }
            }
          },
          blk_neg_ac_content_heading: {
            id: 'blk_neg_ac_content_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestra historia' },
            children: {}
          },
          blk_neg_ac_content_text: {
            id: 'blk_neg_ac_content_text',
            type: 'TextBlock',
            props: { text: 'Desde nuestra fundacion en el 2009, nos hemos dedicado a proporcionar soluciones innovadoras que transforman negocios. Partiendo desde una pequena startup, hemos crecido para servir a empresas de diversos tamanios y sectores, manteniendo siempre nuestro compromiso con la excelencia y la satisfaccion del cliente.' },
            children: {}
          },
          blk_neg_ac_content_spacer: {
            id: 'blk_neg_ac_content_spacer',
            type: 'SpacerBlock',
            props: { height: 'md' },
            children: {}
          },
          blk_neg_ac_values_heading: {
            id: 'blk_neg_ac_values_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestros valores' },
            children: {}
          },
          blk_neg_ac_values_cols: {
            id: 'blk_neg_ac_values_cols',
            type: 'ColumnsBlock',
            props: { columns: 3, gap: 'lg' },
            children: {
              default: {
                id: 'region_neg_ac_values_cols',
                children: ['blk_neg_ac_value_1', 'blk_neg_ac_value_2', 'blk_neg_ac_value_3']
              }
            }
          },
          blk_neg_ac_value_1: {
            id: 'blk_neg_ac_value_1',
            type: 'CardBlock',
            props: {
              title: 'Integridad',
              description: 'Actuamos con transparencia y honestidad en todas nuestras relaciones comerciales'
            },
            children: {}
          },
          blk_neg_ac_value_2: {
            id: 'blk_neg_ac_value_2',
            type: 'CardBlock',
            props: {
              title: 'Innovacion',
              description: 'Buscamos constantemente nuevas formas de mejorar y evolucionar nuestros servicios'
            },
            children: {}
          },
          blk_neg_ac_value_3: {
            id: 'blk_neg_ac_value_3',
            type: 'CardBlock',
            props: {
              title: 'Excelencia',
              description: 'Nos esforzamos por entregar resultados de la mas alta calidad en cada proyecto'
            },
            children: {}
          },
          blk_neg_ac_team: {
            id: 'blk_neg_ac_team',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_ac_team',
                children: ['blk_neg_ac_team_heading', 'blk_neg_ac_team_text']
              }
            }
          },
          blk_neg_ac_team_heading: {
            id: 'blk_neg_ac_team_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Nuestro equipo' },
            children: {}
          },
          blk_neg_ac_team_text: {
            id: 'blk_neg_ac_team_text',
            type: 'TextBlock',
            props: { text: 'Contamos con profesionales altamente capacitados con experiencia en diversas disciplinas. Nuestro equipo multidisciplinario trabaja en conjunto para asegurar que cada proyecto reciba la atencion y expertise que merece.' },
            children: {}
          },
          blk_neg_ac_footer: {
            id: 'blk_neg_ac_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Negocio',
              tagline: 'Soluciones profesionales para tu exito'
            },
            children: {}
          }
        },
        seo: {
          title: 'Acerca de - Mi Negocio',
          description: 'Conoce nuestra historia, valores y equipo profesional',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    },
    {
      id: 'contacto',
      label: 'Contacto',
      routePath: '/contacto',
      required: false,
      page: {
        schemaVersion: 1,
        id: 'page_neg_contacto',
        slug: '/contacto',
        title: 'Contacto',
        visibility: 'public',
        regions: {
          main: { id: 'region_neg_contacto_main', children: ['blk_neg_cont_nav', 'blk_neg_cont_hero', 'blk_neg_cont_form_section', 'blk_neg_cont_info_section', 'blk_neg_cont_footer'] }
        },
        blocks: {
          blk_neg_cont_nav: {
            id: 'blk_neg_cont_nav',
            type: 'NavbarBlock',
            props: {
              logo: 'Mi Negocio',
              links: [
                { label: 'Inicio', href: '/' },
                { label: 'Servicios', href: '/servicios' },
                { label: 'Acerca de', href: '/acerca-de' },
                { label: 'Contacto', href: '/contacto' }
              ]
            },
            children: {}
          },
          blk_neg_cont_hero: {
            id: 'blk_neg_cont_hero',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_cont_hero',
                children: ['blk_neg_cont_hero_heading', 'blk_neg_cont_hero_text']
              }
            }
          },
          blk_neg_cont_hero_heading: {
            id: 'blk_neg_cont_hero_heading',
            type: 'HeadingBlock',
            props: { level: 'h1', text: 'Contactanos' },
            children: {}
          },
          blk_neg_cont_hero_text: {
            id: 'blk_neg_cont_hero_text',
            type: 'TextBlock',
            props: { text: 'Nos encantaria escuchar sobre tu proyecto. Completa el formulario o ponte en contacto directamente.' },
            children: {}
          },
          blk_neg_cont_form_section: {
            id: 'blk_neg_cont_form_section',
            type: 'SectionBlock',
            props: { paddingY: 'lg' },
            children: {
              default: {
                id: 'region_neg_cont_form_section',
                children: ['blk_neg_cont_form_heading', 'blk_neg_cont_form_cols']
              }
            }
          },
          blk_neg_cont_form_heading: {
            id: 'blk_neg_cont_form_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Formulario de contacto' },
            children: {}
          },
          blk_neg_cont_form_cols: {
            id: 'blk_neg_cont_form_cols',
            type: 'ColumnsBlock',
            props: { columns: 2, gap: 'lg' },
            children: {
              default: {
                id: 'region_neg_cont_form_cols',
                children: ['blk_neg_cont_form_col1', 'blk_neg_cont_form_col2']
              }
            }
          },
          blk_neg_cont_form_col1: {
            id: 'blk_neg_cont_form_col1',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_neg_cont_form_col1',
                children: ['blk_neg_cont_form_col1_text']
              }
            }
          },
          blk_neg_cont_form_col1_text: {
            id: 'blk_neg_cont_form_col1_text',
            type: 'TextBlock',
            props: { text: 'Rellena el formulario con tus datos y nos pondremos en contacto en el plazo de 24 horas.' },
            children: {}
          },
          blk_neg_cont_form_col2: {
            id: 'blk_neg_cont_form_col2',
            type: 'ContainerBlock',
            props: {},
            children: {
              default: {
                id: 'region_neg_cont_form_col2',
                children: ['blk_neg_cont_form_col2_text']
              }
            }
          },
          blk_neg_cont_form_col2_text: {
            id: 'blk_neg_cont_form_col2_text',
            type: 'TextBlock',
            props: { text: 'Tambien puedes enviarnos un correo directamente a contacto@minegocio.com o llamarnos al +34 900 123 456.' },
            children: {}
          },
          blk_neg_cont_info_section: {
            id: 'blk_neg_cont_info_section',
            type: 'SectionBlock',
            props: { paddingY: 'lg', background: 'muted' },
            children: {
              default: {
                id: 'region_neg_cont_info_section',
                children: ['blk_neg_cont_info_heading', 'blk_neg_cont_info_grid']
              }
            }
          },
          blk_neg_cont_info_heading: {
            id: 'blk_neg_cont_info_heading',
            type: 'HeadingBlock',
            props: { level: 'h2', text: 'Informacion de contacto' },
            children: {}
          },
          blk_neg_cont_info_grid: {
            id: 'blk_neg_cont_info_grid',
            type: 'GridBlock',
            props: { columns: 3, gap: 'lg' },
            children: {
              default: {
                id: 'region_neg_cont_info_grid',
                children: ['blk_neg_cont_info_email', 'blk_neg_cont_info_phone', 'blk_neg_cont_info_address']
              }
            }
          },
          blk_neg_cont_info_email: {
            id: 'blk_neg_cont_info_email',
            type: 'CardBlock',
            props: {
              title: 'Correo',
              description: 'contacto@minegocio.com'
            },
            children: {}
          },
          blk_neg_cont_info_phone: {
            id: 'blk_neg_cont_info_phone',
            type: 'CardBlock',
            props: {
              title: 'Telefono',
              description: '+34 900 123 456'
            },
            children: {}
          },
          blk_neg_cont_info_address: {
            id: 'blk_neg_cont_info_address',
            type: 'CardBlock',
            props: {
              title: 'Direccion',
              description: 'Calle Empresarial 789, Madrid 28001, Espana'
            },
            children: {}
          },
          blk_neg_cont_footer: {
            id: 'blk_neg_cont_footer',
            type: 'FooterBlock',
            props: {
              companyName: 'Mi Negocio',
              tagline: 'Soluciones profesionales para tu exito'
            },
            children: {}
          }
        },
        seo: {
          title: 'Contacto - Mi Negocio',
          description: 'Ponte en contacto con nosotros para consultas y proyectos',
          canonical: null,
          ogImageAssetId: null
        },
        updatedAt: '2026-01-01T00:00:00.000Z'
      }
    }
  ]
}
