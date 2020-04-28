var pool = ( function () {

    'use strict';

    var urls = [];
    var callback = null;
    var results = null;
    var inLoading = false;

    pool = {

        get: function ( name ){

            return results[name];

        },

        getResult : function(){

            return results;

        },

        load: function( Urls, Callback ){

            if ( typeof Urls == 'string' || Urls instanceof String ) urls.push( Urls );// = [ Urls ];
            else urls = urls.concat( Urls );

            callback = Callback || function(){};

            results = {};

            inLoading = true;

            this.loadOne();

        },

        next: function () {

            urls.shift();
            if( urls.length === 0 ){ 
                inLoading = false;
                callback( results );

                //console.log(results)
            }
            else this.loadOne();

        },

        loadOne: function(){

            var link = urls[0];

            var name = link.substring( link.lastIndexOf('/')+1, link.lastIndexOf('.') );
            var type = link.substring( link.lastIndexOf('.')+1 );


            //console.log( name, type );

            if( type === 'jpg' || type === 'png' ) this.loadImage( link, name );
            else this[ type + '_load' ]( link, name );

        },

        loadImage: function ( url, name ) {

            var img = new Image();

            img.onload = function(){

                results[name] = img;
                this.next();

            }.bind( this );

            img.src = url;

        },

        sea_load: function ( url, name ) {

            var l = new THREE.SEA3D();

            l.onComplete = function( e ) {

                results[name] = l.meshes;
                this.next();

            }.bind( this );

            l.load( url );

        },

        json_load: function ( url, name ) {

            var xml = new XMLHttpRequest();
            xml.overrideMimeType( "application/json" );

            xml.onload = function () {

                results[name] = JSON.parse( xml.responseText );
                this.next();

            }.bind( this );

            xml.open( 'GET', url, true );
            xml.send( null );

        },

        glsl_load: function ( url, name ) {

            var xml = new XMLHttpRequest();

            xml.onload = function () {

                results[name] = xml.responseText;
                this.next();

            }.bind( this );

            xml.open( 'GET', url, true );
            xml.send( null );

        },

    };

    return pool;

})();